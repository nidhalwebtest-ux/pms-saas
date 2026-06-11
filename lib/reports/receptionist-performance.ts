import { prisma } from "@/lib/prisma";

/**
 * Receptionist Performance — staff productivity over the period.
 *
 * Per user (whoever performed the work):
 *   reservations = ReservationActivity CREATED
 *   checkIns / checkOuts = ReservationActivity CHECKED_IN / CHECKED_OUT
 *   payments / collected = Payment.receivedById (non-refund) count + amount
 *
 * The building filter is best-effort (activities via reservation property,
 * payments via invoice/allocation/reservation property); org-wide is exact.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface StaffRow {
  id: string;
  name: string;
  role: string;
  reservations: number;
  checkIns: number;
  checkOuts: number;
  payments: number;
  collected: number;
  totalActions: number;   // reservations + checkIns + checkOuts + payments
}
export interface StaffReport {
  kpis: {
    collected: number;
    reservations: number;
    checkIns: number;
    checkOuts: number;
    payments: number;
    staffCount: number;
    topName: string | null;
    topCollected: number;
  };
  staff: StaffRow[];
  rangeDays: number;
}

export async function getReceptionistPerformance(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<StaffReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const activityPropertyFilter = propertyId
    ? { reservation: { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } }
    : {};
  const paymentPropertyFilter = propertyId
    ? {
        OR: [
          { invoice: { propertyId } },
          { allocations: { some: { invoice: { propertyId } } } },
          { reservation: { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } },
        ],
      }
    : {};

  const [activities, payments] = await Promise.all([
    prisma.reservationActivity.findMany({
      where: {
        organizationId: orgId,
        action: { in: ["CREATED", "CHECKED_IN", "CHECKED_OUT"] },
        createdAt: { gte: rangeFrom, lt: rangeToExclusive },
        performedById: { not: null },
        ...activityPropertyFilter,
      },
      select: { performedById: true, action: true },
    }),
    prisma.payment.findMany({
      where: { organizationId: orgId, isRefund: false, date: { gte: rangeFrom, lt: rangeToExclusive }, receivedById: { not: null }, ...paymentPropertyFilter },
      select: { receivedById: true, amount: true },
    }),
  ]);

  type Acc = { reservations: number; checkIns: number; checkOuts: number; payments: number; collected: number };
  const byUser = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = byUser.get(id);
    if (!a) { a = { reservations: 0, checkIns: 0, checkOuts: 0, payments: 0, collected: 0 }; byUser.set(id, a); }
    return a;
  };

  for (const act of activities) {
    if (!act.performedById) continue;
    const a = ensure(act.performedById);
    if (act.action === "CREATED") a.reservations++;
    else if (act.action === "CHECKED_IN") a.checkIns++;
    else if (act.action === "CHECKED_OUT") a.checkOuts++;
  }
  for (const p of payments) {
    if (!p.receivedById) continue;
    const a = ensure(p.receivedById);
    a.payments++;
    a.collected = r3(a.collected + Math.abs(Number(p.amount)));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  const userInfo = new Map(users.map((u) => [u.id, { name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "—", role: u.role as string }]));

  const staff: StaffRow[] = [...byUser.entries()].map(([id, a]) => ({
    id,
    name: userInfo.get(id)?.name ?? "—",
    role: userInfo.get(id)?.role ?? "STAFF",
    reservations: a.reservations,
    checkIns: a.checkIns,
    checkOuts: a.checkOuts,
    payments: a.payments,
    collected: a.collected,
    totalActions: a.reservations + a.checkIns + a.checkOuts + a.payments,
  })).sort((a, c) => c.collected - a.collected || c.totalActions - a.totalActions);

  const sum = (sel: (s: StaffRow) => number) => staff.reduce((s2, x) => s2 + sel(x), 0);
  const top = staff[0];

  return {
    kpis: {
      collected: r3(sum((s) => s.collected)),
      reservations: sum((s) => s.reservations),
      checkIns: sum((s) => s.checkIns),
      checkOuts: sum((s) => s.checkOuts),
      payments: sum((s) => s.payments),
      staffCount: staff.length,
      topName: top?.name ?? null,
      topCollected: top?.collected ?? 0,
    },
    staff,
    rangeDays,
  };
}
