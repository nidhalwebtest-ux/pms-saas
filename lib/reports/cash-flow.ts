import { prisma } from "@/lib/prisma";

/**
 * Cash Flow — money in vs money out over time (day / week / month), cash basis.
 *
 *   Inflows  = payments received (Payment, isRefund=false) by payment date.
 *   Outflows = refunds (Payment isRefund=true) + expenses that have been approved
 *              or processed (status APPROVED/PROCESSED) by their effective date
 *              (processedAt ?? reviewedAt ?? submittedAt).
 *   Net      = inflows − outflows; Cumulative = running sum of net (opening 0).
 *
 * The building filter is best-effort for payments (attributed via invoice /
 * allocation / reservation property); expenses filter exactly on propertyId.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export type Granularity = "day" | "week" | "month";

export interface CashBucket {
  key: string;
  start: string;
  end: string;
  inflows: number;
  expenses: number;
  refunds: number;
  outflows: number;   // = expenses + refunds
  net: number;        // inflows − outflows
  cumulative: number; // running net
  txCount: number;
}
export interface CashReport {
  granularity: Granularity;
  buckets: CashBucket[];
  kpis: {
    inflows: number;
    outflows: number;
    expenses: number;
    refunds: number;
    net: number;
    txCount: number;
    peakNet: number;
    peakKey: string | null;
  };
  rangeDays: number;
}

function pickGranularity(rangeDays: number, override?: string): Granularity {
  if (override === "day" || override === "week" || override === "month") return override;
  if (rangeDays <= 31) return "day";
  if (rangeDays <= 120) return "week";
  return "month";
}

function buildBuckets(fromMs: number, toExclusiveMs: number, gran: Granularity): { startMs: number; endMs: number }[] {
  const out: { startMs: number; endMs: number }[] = [];
  if (gran === "month") {
    let cur = Date.UTC(new Date(fromMs).getUTCFullYear(), new Date(fromMs).getUTCMonth(), 1);
    while (cur < toExclusiveMs) {
      const d = new Date(cur);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      out.push({ startMs: Math.max(cur, fromMs), endMs: Math.min(next, toExclusiveMs) });
      cur = next;
    }
  } else {
    const step = (gran === "week" ? 7 : 1) * DAY;
    for (let s = fromMs; s < toExclusiveMs; s += step) out.push({ startMs: s, endMs: Math.min(s + step, toExclusiveMs) });
  }
  return out;
}

export async function getCashFlow(params: {
  orgId: string; from: Date; to: Date; propertyId?: string; bucket?: string;
}): Promise<CashReport> {
  const { orgId, from, to, propertyId, bucket } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);
  const gran = pickGranularity(rangeDays, bucket);
  const buckets = buildBuckets(fromMs, toExclusiveMs, gran);
  const findBucket = (ms: number) => {
    const day = toDay(new Date(ms));
    for (let i = 0; i < buckets.length; i++) if (day >= buckets[i].startMs && day < buckets[i].endMs) return i;
    return -1;
  };

  const paymentPropertyFilter = propertyId
    ? {
        OR: [
          { invoice: { propertyId } },
          { allocations: { some: { invoice: { propertyId } } } },
          { reservation: { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } },
        ],
      }
    : {};

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId: orgId, date: { gte: rangeFrom, lt: rangeToExclusive }, ...paymentPropertyFilter },
      select: { amount: true, date: true, isRefund: true },
    }),
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["APPROVED", "PROCESSED"] },
        submittedAt: { lt: rangeToExclusive },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { amount: true, submittedAt: true, reviewedAt: true, processedAt: true },
    }),
  ]);

  const inflow = new Array(buckets.length).fill(0);
  const refundOut = new Array(buckets.length).fill(0);
  const expenseOut = new Array(buckets.length).fill(0);
  const txc = new Array(buckets.length).fill(0);

  for (const p of payments) {
    const bi = findBucket(p.date.getTime());
    if (bi < 0) continue;
    const amt = Math.abs(Number(p.amount));
    if (p.isRefund) refundOut[bi] = r3(refundOut[bi] + amt);
    else inflow[bi] = r3(inflow[bi] + amt);
    txc[bi]++;
  }

  for (const e of expenses) {
    const eff = (e.processedAt ?? e.reviewedAt ?? e.submittedAt).getTime();
    if (eff < fromMs || eff >= toExclusiveMs) continue;   // effective date outside window
    const bi = findBucket(eff);
    if (bi < 0) continue;
    expenseOut[bi] = r3(expenseOut[bi] + Number(e.amount));
    txc[bi]++;
  }

  let running = 0;
  const bucketsOut: CashBucket[] = buckets.map((b, i) => {
    const outflows = r3(expenseOut[i] + refundOut[i]);
    const net = r3(inflow[i] - outflows);
    running = r3(running + net);
    return {
      key: new Date(b.startMs).toISOString(),
      start: new Date(b.startMs).toISOString(),
      end: new Date(b.endMs).toISOString(),
      inflows: r3(inflow[i]),
      expenses: r3(expenseOut[i]),
      refunds: r3(refundOut[i]),
      outflows,
      net,
      cumulative: running,
      txCount: txc[i],
    };
  });

  const inflows = r3(bucketsOut.reduce((s, b) => s + b.inflows, 0));
  const expensesTot = r3(bucketsOut.reduce((s, b) => s + b.expenses, 0));
  const refundsTot = r3(bucketsOut.reduce((s, b) => s + b.refunds, 0));
  const outflows = r3(expensesTot + refundsTot);
  const txCount = bucketsOut.reduce((s, b) => s + b.txCount, 0);
  let peak = bucketsOut[0] ?? null;
  for (const b of bucketsOut) if (b.net > (peak?.net ?? -Infinity)) peak = b;

  return {
    granularity: gran,
    buckets: bucketsOut,
    kpis: {
      inflows, outflows, expenses: expensesTot, refunds: refundsTot,
      net: r3(inflows - outflows),
      txCount,
      peakNet: peak?.net ?? 0,
      peakKey: peak?.key ?? null,
    },
    rangeDays,
  };
}
