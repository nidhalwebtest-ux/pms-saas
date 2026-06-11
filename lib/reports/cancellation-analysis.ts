import { prisma } from "@/lib/prisma";

/**
 * Cancellation Analysis — of reservations BOOKED in the period (by createdAt),
 * which ended up CANCELLED or NO_SHOW. A cohort view grouped by source:
 *   total      = all reservations booked from that source in the window
 *   cancelled  = CANCELLED + NO_SHOW among them
 *   rate       = cancelled / total
 *   lostValue  = booked value of the cancelled ones (grandTotal → totalAmount → amount)
 * Leaves are the individual cancellations (status, reason, date, value).
 * Same createdAt cohort basis as Booking Sources. Building filter best-effort.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const UNKNOWN = "other";
const bookedValue = (r: { grandTotal: unknown; totalAmount: unknown; amount: unknown }) => {
  const g = Number(r.grandTotal), tot = Number(r.totalAmount), amt = Number(r.amount);
  return g > 0 ? g : tot > 0 ? tot : amt;
};

export interface CancelItem {
  id: string;
  number: string | null;
  status: string;        // CANCELLED | NO_SHOW
  reason: string | null;
  date: string;          // ISO — cancelledAt, fallback startDate
  value: number;
}
export interface CancelSource {
  source: string;
  total: number;
  cancellations: number;
  noShows: number;
  rate: number;          // cancelled / total, 0..1
  lostValue: number;
  items: CancelItem[];
}
export interface CancelReport {
  kpis: {
    cancellations: number;
    noShows: number;
    total: number;       // total reservations booked in window
    rate: number;        // overall cancelled / total
    lostValue: number;
    sourceCount: number;
  };
  sources: CancelSource[];
  rangeDays: number;
}

export async function getCancellationAnalysis(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<CancelReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } : {}),
    },
    select: {
      id: true, reservationNumber: true, status: true, source: true,
      cancelledReason: true, cancelledAt: true, startDate: true,
      grandTotal: true, totalAmount: true, amount: true,
    },
  });

  type Acc = { total: number; cancellations: number; noShows: number; lostValue: number; items: CancelItem[] };
  const bySource = new Map<string, Acc>();
  const ensure = (s: string): Acc => {
    let a = bySource.get(s);
    if (!a) { a = { total: 0, cancellations: 0, noShows: 0, lostValue: 0, items: [] }; bySource.set(s, a); }
    return a;
  };

  let totalAll = 0, cancelledAll = 0, noShowAll = 0, lostAll = 0;

  for (const r of reservations) {
    const a = ensure(r.source || UNKNOWN);
    a.total++; totalAll++;
    const isCancel = r.status === "CANCELLED" || r.status === "NO_SHOW";
    if (!isCancel) continue;
    const val = r3(bookedValue(r));
    a.cancellations++; cancelledAll++;
    a.lostValue = r3(a.lostValue + val); lostAll = r3(lostAll + val);
    if (r.status === "NO_SHOW") { a.noShows++; noShowAll++; }
    a.items.push({
      id: r.id, number: r.reservationNumber, status: r.status,
      reason: r.cancelledReason, date: (r.cancelledAt ?? r.startDate).toISOString(), value: val,
    });
  }

  const sources: CancelSource[] = [...bySource.entries()]
    .filter(([, a]) => a.cancellations > 0)
    .map(([source, a]) => ({
      source,
      total: a.total,
      cancellations: a.cancellations,
      noShows: a.noShows,
      rate: a.total > 0 ? r3(a.cancellations / a.total) : 0,
      lostValue: a.lostValue,
      items: a.items.sort((x, y) => y.value - x.value),
    }))
    .sort((x, y) => y.cancellations - x.cancellations || y.lostValue - x.lostValue);

  return {
    kpis: {
      cancellations: cancelledAll,
      noShows: noShowAll,
      total: totalAll,
      rate: totalAll > 0 ? r3(cancelledAll / totalAll) : 0,
      lostValue: r3(lostAll),
      sourceCount: sources.length,
    },
    sources,
    rangeDays,
  };
}
