import { prisma } from "@/lib/prisma";

/**
 * Spend by Vendor — how much has been paid to each vendor in a period.
 *
 * Only APPROVED/PROCESSED expenses count (matches getPnlByBuilding's
 * correctness rule — pending/rejected expenses have not actually been
 * paid out). Effective date = processedAt ?? reviewedAt ?? submittedAt,
 * same as pnl-by-building.ts, so the two reports agree on which expenses
 * fall inside a given period.
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const DAY = 86_400_000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface VendorSpendRow {
  vendorId: string;
  vendorName: string;
  categoryName: string | null;
  expenseCount: number;
  totalSpend: number;
  percentOfTotal: number; // 0-100
}

export interface SpendByVendorReport {
  kpis: {
    totalSpend: number;
    vendorCount: number;
    expenseCount: number;
  };
  vendors: VendorSpendRow[];
}

export async function getSpendByVendor(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<SpendByVendorReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;

  const expenses = await prisma.expense.findMany({
    where: {
      organizationId: orgId,
      vendorId: { not: null },
      status: { in: ["APPROVED", "PROCESSED"] },
      submittedAt: { lt: new Date(toExclusiveMs) },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      amount: true, submittedAt: true, reviewedAt: true, processedAt: true,
      vendorId: true,
      vendor: { select: { id: true, name: true, category: { select: { name: true } } } },
    },
  });

  type Acc = { vendorId: string; vendorName: string; categoryName: string | null; count: number; amount: number };
  const byVendor = new Map<string, Acc>();

  for (const e of expenses) {
    const eff = (e.processedAt ?? e.reviewedAt ?? e.submittedAt).getTime();
    if (eff < fromMs || eff >= toExclusiveMs) continue;
    if (!e.vendorId || !e.vendor) continue;

    let acc = byVendor.get(e.vendorId);
    if (!acc) {
      acc = {
        vendorId: e.vendorId,
        vendorName: e.vendor.name,
        categoryName: e.vendor.category?.name ?? null,
        count: 0,
        amount: 0,
      };
      byVendor.set(e.vendorId, acc);
    }
    acc.count += 1;
    acc.amount = r3(acc.amount + Number(e.amount));
  }

  const totalSpend = r3([...byVendor.values()].reduce((s, v) => s + v.amount, 0));
  const totalExpenseCount = [...byVendor.values()].reduce((s, v) => s + v.count, 0);

  const vendors: VendorSpendRow[] = [...byVendor.values()]
    .map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      categoryName: v.categoryName,
      expenseCount: v.count,
      totalSpend: v.amount,
      percentOfTotal: totalSpend > 0 ? r3((v.amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  return {
    kpis: {
      totalSpend,
      vendorCount: vendors.length,
      expenseCount: totalExpenseCount,
    },
    vendors,
  };
}
