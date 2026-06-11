import { prisma } from "@/lib/prisma";

/**
 * Maintenance — upkeep activity by building. Combines two signals:
 *   jobs / spend = maintenance-category expenses (category name ~ "mainten"/"repair")
 *                  logged in the period (by submittedAt; status != REJECTED).
 *                  spend = APPROVED/PROCESSED amount; pending = PENDING amount.
 *   unitsDown    = units currently flagged Unit.status = MAINTENANCE (point-in-time).
 * Grouped Building → maintenance item (expense). Building filter is exact.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface MaintItem {
  id: string;
  number: string;
  description: string;
  status: string;
  date: string;        // ISO — submittedAt
  amount: number;
}
export interface MaintBuilding {
  id: string;
  name: string;
  jobs: number;
  spend: number;       // approved + processed
  pending: number;     // awaiting approval
  unitsDown: number;
  items: MaintItem[];
}
export interface MaintReport {
  kpis: {
    spend: number;
    pending: number;
    jobs: number;
    unitsDown: number;
    buildingCount: number;
  };
  buildings: MaintBuilding[];
  rangeDays: number;
}

export async function getMaintenance(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<MaintReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const [expenses, unitsDown] = await Promise.all([
    prisma.expense.findMany({
      where: {
        organizationId: orgId,
        status: { not: "REJECTED" },
        submittedAt: { gte: rangeFrom, lt: rangeToExclusive },
        category: { OR: [{ name: { contains: "mainten", mode: "insensitive" } }, { name: { contains: "repair", mode: "insensitive" } }] },
        ...(propertyId ? { propertyId } : {}),
      },
      select: {
        id: true, expenseNumber: true, description: true, amount: true, status: true, submittedAt: true,
        propertyId: true, property: { select: { name: true } },
      },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId: orgId }, status: "MAINTENANCE", ...(propertyId ? { propertyId } : {}) },
      select: { propertyId: true, property: { select: { name: true } } },
    }),
  ]);

  type BAcc = { id: string; name: string; jobs: number; spend: number; pending: number; unitsDown: number; items: MaintItem[] };
  const buildings = new Map<string, BAcc>();
  const ensure = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, jobs: 0, spend: 0, pending: 0, unitsDown: 0, items: [] }; buildings.set(pid, b); }
    return b;
  };

  for (const e of expenses) {
    if (!e.propertyId) continue;
    const amt = Number(e.amount);
    const b = ensure(e.propertyId, e.property?.name ?? "—");
    b.jobs++;
    if (e.status === "PENDING") b.pending = r3(b.pending + amt);
    else b.spend = r3(b.spend + amt);   // APPROVED / PROCESSED
    b.items.push({ id: e.id, number: e.expenseNumber, description: e.description, status: e.status, date: e.submittedAt.toISOString(), amount: r3(amt) });
  }
  for (const u of unitsDown) {
    if (!u.propertyId) continue;
    ensure(u.propertyId, u.property?.name ?? "—").unitsDown++;
  }

  const buildingsOut: MaintBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name, jobs: b.jobs, spend: b.spend, pending: b.pending, unitsDown: b.unitsDown,
    items: b.items.sort((a, c) => c.date.localeCompare(a.date)),
  })).sort((a, c) => c.spend + c.pending - (a.spend + a.pending) || c.unitsDown - a.unitsDown);

  return {
    kpis: {
      spend: r3(buildingsOut.reduce((s, b) => s + b.spend, 0)),
      pending: r3(buildingsOut.reduce((s, b) => s + b.pending, 0)),
      jobs: buildingsOut.reduce((s, b) => s + b.jobs, 0),
      unitsDown: buildingsOut.reduce((s, b) => s + b.unitsDown, 0),
      buildingCount: buildingsOut.length,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
