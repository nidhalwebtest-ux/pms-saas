import { prisma } from "@/lib/prisma";
import { getRevenueByBuilding } from "./revenue-by-building";

/**
 * P&L by Building — net profit per building = net revenue − expenses.
 *
 *   Revenue  = net posting revenue (reuses getRevenueByBuilding: issued invoices
 *              minus active returns).
 *   Expenses = approved/processed expenses (status APPROVED/PROCESSED) incurred in
 *              the period (effective date processedAt ?? reviewedAt ?? submittedAt),
 *              broken down by category.
 *   Net = revenue − expenses; Margin = net / revenue.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface PnlCategory {
  id: string;
  name: string;
  nameAr: string | null;
  icon: string | null;
  amount: number;
}
export interface PnlBuilding {
  id: string;
  name: string;
  revenue: number;
  expenses: number;
  net: number;
  margin: number | null;   // net / revenue; null when revenue is 0
  categories: PnlCategory[];
}
export interface PnlReport {
  kpis: {
    revenue: number;
    expenses: number;
    net: number;
    margin: number | null;
    buildingCount: number;
    profitableCount: number;
  };
  buildings: PnlBuilding[];
  rangeDays: number;
}

export async function getPnlByBuilding(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<PnlReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));

  const [rev, expenses] = await Promise.all([
    getRevenueByBuilding({ orgId, from, to, propertyId }),
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["APPROVED", "PROCESSED"] },
        submittedAt: { lt: new Date(toExclusiveMs) },
        ...(propertyId ? { propertyId } : {}),
      },
      select: {
        amount: true, propertyId: true, submittedAt: true, reviewedAt: true, processedAt: true,
        property: { select: { name: true } },
        category: { select: { id: true, name: true, nameAr: true, icon: true } },
      },
    }),
  ]);

  type CatAcc = { id: string; name: string; nameAr: string | null; icon: string | null; amount: number };
  type BAcc = { id: string; name: string; revenue: number; expenses: number; cats: Map<string, CatAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, revenue: 0, expenses: 0, cats: new Map() }; buildings.set(pid, b); }
    return b;
  };

  // Revenue side
  for (const b of rev.buildings) ensureB(b.id, b.name).revenue = b.revenue;

  // Expense side (by effective date within window)
  for (const e of expenses) {
    if (!e.propertyId) continue;
    const eff = (e.processedAt ?? e.reviewedAt ?? e.submittedAt).getTime();
    if (eff < fromMs || eff >= toExclusiveMs) continue;
    const amt = Number(e.amount);
    const b = ensureB(e.propertyId, e.property?.name ?? "—");
    b.expenses = r3(b.expenses + amt);
    const cid = e.category?.id ?? "other";
    let c = b.cats.get(cid);
    if (!c) { c = { id: cid, name: e.category?.name ?? "Other", nameAr: e.category?.nameAr ?? null, icon: e.category?.icon ?? null, amount: 0 }; b.cats.set(cid, c); }
    c.amount = r3(c.amount + amt);
  }

  const buildingsOut: PnlBuilding[] = [...buildings.values()].map((b) => {
    const net = r3(b.revenue - b.expenses);
    return {
      id: b.id, name: b.name, revenue: r3(b.revenue), expenses: r3(b.expenses), net,
      margin: b.revenue > 0 ? r3(net / b.revenue) : null,
      categories: [...b.cats.values()].map((c) => ({ ...c, amount: r3(c.amount) })).sort((a, c) => c.amount - a.amount),
    };
  }).sort((a, c) => c.net - a.net);

  const revenue = r3(buildingsOut.reduce((s, b) => s + b.revenue, 0));
  const expensesTot = r3(buildingsOut.reduce((s, b) => s + b.expenses, 0));
  const net = r3(revenue - expensesTot);

  return {
    kpis: {
      revenue,
      expenses: expensesTot,
      net,
      margin: revenue > 0 ? r3(net / revenue) : null,
      buildingCount: buildingsOut.length,
      profitableCount: buildingsOut.filter((b) => b.net > 0).length,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
