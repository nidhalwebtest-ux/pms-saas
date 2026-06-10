import { prisma } from "@/lib/prisma";

/**
 * Revenue Trend — net revenue bucketed over time (day / week / month).
 *
 * Same posting basis as Revenue by Building (issued invoices by issueDate +,
 * active returns by createdAt −). Each time bucket gets its net = invoiced −
 * returned, so a bucket can be negative if credit notes outweigh invoices.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export type Granularity = "day" | "week" | "month";

export interface RevTrendBucket {
  key: string;            // ISO bucket start
  start: string;
  end: string;
  net: number;
  invoiced: number;
  returned: number;
  txCount: number;
}
export interface RevTrendReport {
  granularity: Granularity;
  buckets: RevTrendBucket[];
  kpis: {
    total: number;
    invoiced: number;
    returned: number;
    txCount: number;
    avgPerBucket: number;
    peakNet: number;
    peakKey: string | null;
    deltaPct: number;       // (last − first) / |first| × 100
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

export async function getRevenueTrend(params: {
  orgId: string; from: Date; to: Date; propertyId?: string; bucket?: string;
}): Promise<RevTrendReport> {
  const { orgId, from, to, propertyId, bucket } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);
  const gran = pickGranularity(rangeDays, bucket);
  const buckets = buildBuckets(fromMs, toExclusiveMs, gran);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { issueDate: true, lineItems: { select: { lineTotal: true } } },
  });

  const returns = await prisma.return.findMany({
    where: {
      organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { invoice: { propertyId } } : {}),
    },
    select: { createdAt: true, lineItems: { select: { lineTotal: true } } },
  });

  // Bucket index for a day timestamp.
  const findBucket = (ms: number) => {
    const day = toDay(new Date(ms));
    for (let i = 0; i < buckets.length; i++) if (day >= buckets[i].startMs && day < buckets[i].endMs) return i;
    return -1;
  };

  const inv = new Array(buckets.length).fill(0);
  const ret = new Array(buckets.length).fill(0);
  const txc = new Array(buckets.length).fill(0);

  for (const i of invoices) {
    if (!i.issueDate) continue;
    const bi = findBucket(i.issueDate.getTime());
    if (bi < 0) continue;
    inv[bi] = r3(inv[bi] + i.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
    txc[bi]++;
  }
  for (const r of returns) {
    const bi = findBucket(r.createdAt.getTime());
    if (bi < 0) continue;
    ret[bi] = r3(ret[bi] + r.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
    txc[bi]++;
  }

  const bucketsOut: RevTrendBucket[] = buckets.map((b, i) => ({
    key: new Date(b.startMs).toISOString(),
    start: new Date(b.startMs).toISOString(),
    end: new Date(b.endMs).toISOString(),
    net: r3(inv[i] - ret[i]),
    invoiced: r3(inv[i]),
    returned: r3(ret[i]),
    txCount: txc[i],
  }));

  const total = r3(bucketsOut.reduce((s, b) => s + b.net, 0));
  const invoiced = r3(bucketsOut.reduce((s, b) => s + b.invoiced, 0));
  const returned = r3(bucketsOut.reduce((s, b) => s + b.returned, 0));
  const txCount = bucketsOut.reduce((s, b) => s + b.txCount, 0);
  let peak = bucketsOut[0] ?? null;
  for (const b of bucketsOut) if (b.net > (peak?.net ?? -Infinity)) peak = b;
  const nonEmpty = bucketsOut.filter((b) => b.txCount > 0);
  const first = nonEmpty[0], last = nonEmpty[nonEmpty.length - 1];
  const deltaPct = first && last && Math.abs(first.net) > 0 ? r3(((last.net - first.net) / Math.abs(first.net)) * 100) : 0;

  return {
    granularity: gran,
    buckets: bucketsOut,
    kpis: {
      total, invoiced, returned, txCount,
      avgPerBucket: bucketsOut.length > 0 ? r3(total / bucketsOut.length) : 0,
      peakNet: peak?.net ?? 0,
      peakKey: peak?.key ?? null,
      deltaPct,
    },
    rangeDays,
  };
}
