import { prisma } from "@/lib/prisma";

/**
 * VAT Summary — output VAT (on sales) as a monthly tax-period register, for VAT
 * return filing. Based on issued invoices (status not DRAFT/CANCELLED/VOID) by
 * issueDate:
 *   vat          = Σ Invoice.taxAmount
 *   taxableSales = Σ (totalAmount − taxAmount)   (net of VAT, after discount)
 *   gross        = Σ totalAmount
 * Bucketed by calendar month (VAT periods). Returns/credit notes carry no tax
 * breakdown in the schema, so they are NOT tax-adjusted here (noted in the UI).
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface VatBucket {
  key: string;          // ISO month start
  start: string;
  end: string;
  taxableSales: number;
  vat: number;
  gross: number;
  invoiceCount: number;
}
export interface VatReport {
  buckets: VatBucket[];
  kpis: {
    taxableSales: number;
    vat: number;
    gross: number;
    effectiveRate: number;   // vat / taxableSales
    invoiceCount: number;
  };
  rangeDays: number;
}

function monthBuckets(fromMs: number, toExclusiveMs: number): { startMs: number; endMs: number }[] {
  const out: { startMs: number; endMs: number }[] = [];
  let cur = Date.UTC(new Date(fromMs).getUTCFullYear(), new Date(fromMs).getUTCMonth(), 1);
  while (cur < toExclusiveMs) {
    const d = new Date(cur);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    out.push({ startMs: Math.max(cur, fromMs), endMs: Math.min(next, toExclusiveMs) });
    cur = next;
  }
  return out;
}

export async function getVatSummary(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<VatReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);
  const buckets = monthBuckets(fromMs, toExclusiveMs);
  const findBucket = (ms: number) => {
    const day = toDay(new Date(ms));
    for (let i = 0; i < buckets.length; i++) if (day >= buckets[i].startMs && day < buckets[i].endMs) return i;
    return -1;
  };

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { issueDate: true, totalAmount: true, taxAmount: true },
  });

  const taxable = new Array(buckets.length).fill(0);
  const vatArr = new Array(buckets.length).fill(0);
  const grossArr = new Array(buckets.length).fill(0);
  const counts = new Array(buckets.length).fill(0);

  for (const inv of invoices) {
    if (!inv.issueDate) continue;
    const bi = findBucket(inv.issueDate.getTime());
    if (bi < 0) continue;
    const gross = Number(inv.totalAmount);
    const vat = Number(inv.taxAmount);
    grossArr[bi] = r3(grossArr[bi] + gross);
    vatArr[bi] = r3(vatArr[bi] + vat);
    taxable[bi] = r3(taxable[bi] + (gross - vat));
    counts[bi]++;
  }

  const bucketsOut: VatBucket[] = buckets.map((b, i) => ({
    key: new Date(b.startMs).toISOString(),
    start: new Date(b.startMs).toISOString(),
    end: new Date(b.endMs).toISOString(),
    taxableSales: r3(taxable[i]),
    vat: r3(vatArr[i]),
    gross: r3(grossArr[i]),
    invoiceCount: counts[i],
  }));

  const taxableSales = r3(bucketsOut.reduce((s, b) => s + b.taxableSales, 0));
  const vat = r3(bucketsOut.reduce((s, b) => s + b.vat, 0));
  const gross = r3(bucketsOut.reduce((s, b) => s + b.gross, 0));
  const invoiceCount = bucketsOut.reduce((s, b) => s + b.invoiceCount, 0);

  return {
    buckets: bucketsOut,
    kpis: {
      taxableSales, vat, gross,
      effectiveRate: taxableSales > 0 ? r3(vat / taxableSales) : 0,
      invoiceCount,
    },
    rangeDays,
  };
}
