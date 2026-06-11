import { prisma } from "@/lib/prisma";

/**
 * Expense Breakdown — where the money goes, grouped Category → Expense.
 *
 * Counts approved/processed expenses (status APPROVED/PROCESSED) incurred in the
 * period by their effective date (processedAt ?? reviewedAt ?? submittedAt) — the
 * same basis as Cash Flow / P&L, so the totals cross-check. Pending (awaiting
 * approval) expenses are surfaced as a context KPI, not in the breakdown.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const effDate = (e: { processedAt: Date | null; reviewedAt: Date | null; submittedAt: Date }) =>
  (e.processedAt ?? e.reviewedAt ?? e.submittedAt).getTime();

export interface ExpItem {
  id: string;
  number: string;
  description: string;
  building: string;
  date: string;       // ISO
  status: string;
  amount: number;
}
export interface ExpCategory {
  id: string;
  name: string;
  nameAr: string | null;
  icon: string | null;
  amount: number;
  count: number;
  expenses: ExpItem[];
}
export interface ExpReport {
  kpis: {
    total: number;
    count: number;
    categoryCount: number;
    topName: string | null;
    topNameAr: string | null;
    topAmount: number;
    avgPerExpense: number;
    pending: number;
    pendingCount: number;
  };
  categories: ExpCategory[];
  rangeDays: number;
}

export async function getExpenseBreakdown(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<ExpReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeToExclusive = new Date(toExclusiveMs);

  const [expenses, pendingRows] = await Promise.all([
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["APPROVED", "PROCESSED"] },
        submittedAt: { lt: rangeToExclusive },
        ...(propertyId ? { propertyId } : {}),
      },
      select: {
        id: true, expenseNumber: true, description: true, amount: true, status: true,
        submittedAt: true, reviewedAt: true, processedAt: true,
        property: { select: { name: true } },
        category: { select: { id: true, name: true, nameAr: true, icon: true } },
      },
    }),
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        status: "PENDING",
        submittedAt: { gte: new Date(fromMs), lt: rangeToExclusive },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { amount: true },
    }),
  ]);

  type CatAcc = { id: string; name: string; nameAr: string | null; icon: string | null; amount: number; expenses: ExpItem[] };
  const cats = new Map<string, CatAcc>();

  for (const e of expenses) {
    const eff = effDate(e);
    if (eff < fromMs || eff >= toExclusiveMs) continue;
    const amt = Number(e.amount);
    const cid = e.category?.id ?? "other";
    let c = cats.get(cid);
    if (!c) { c = { id: cid, name: e.category?.name ?? "Other", nameAr: e.category?.nameAr ?? null, icon: e.category?.icon ?? null, amount: 0, expenses: [] }; cats.set(cid, c); }
    c.amount = r3(c.amount + amt);
    c.expenses.push({
      id: e.id, number: e.expenseNumber, description: e.description,
      building: e.property?.name ?? "—", date: new Date(eff).toISOString(), status: e.status, amount: r3(amt),
    });
  }

  const categories: ExpCategory[] = [...cats.values()].map((c) => ({
    id: c.id, name: c.name, nameAr: c.nameAr, icon: c.icon, amount: c.amount, count: c.expenses.length,
    expenses: c.expenses.sort((a, b) => b.amount - a.amount),
  })).sort((a, b) => b.amount - a.amount);

  const total = r3(categories.reduce((s, c) => s + c.amount, 0));
  const count = categories.reduce((s, c) => s + c.count, 0);
  const top = categories[0];
  const pending = r3(pendingRows.reduce((s, p) => s + Number(p.amount), 0));

  return {
    kpis: {
      total,
      count,
      categoryCount: categories.length,
      topName: top?.name ?? null,
      topNameAr: top?.nameAr ?? null,
      topAmount: top?.amount ?? 0,
      avgPerExpense: count > 0 ? r3(total / count) : 0,
      pending,
      pendingCount: pendingRows.length,
    },
    categories,
    rangeDays,
  };
}
