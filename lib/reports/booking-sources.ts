import { prisma } from "@/lib/prisma";

/**
 * Booking Sources — acquisition-channel analysis. Counts reservations BOOKED in
 * the period (by createdAt, excl. CANCELLED/NO_SHOW) grouped by their source
 * (walk_in / phone / online / booking_com / …), with nights and booked value.
 *
 * Reservation-centric (vs invoice-centric Revenue by Source). Booked value =
 * grandTotal, falling back to totalAmount then amount. Building filter best-effort.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const UNKNOWN = "other";

export interface SourceRow {
  source: string;
  bookings: number;
  nights: number;
  value: number;
  avgValue: number;
  share: number;   // share of bookings, 0..1
}
export interface BookingSourcesReport {
  kpis: {
    bookings: number;
    nights: number;
    value: number;
    avgValue: number;
    sourceCount: number;
    topSource: string | null;
    topBookings: number;
  };
  sources: SourceRow[];
  rangeDays: number;
}

export async function getBookingSources(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<BookingSourcesReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      createdAt: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } : {}),
    },
    select: { source: true, totalNights: true, grandTotal: true, totalAmount: true, amount: true },
  });

  type Acc = { bookings: number; nights: number; value: number };
  const bySource = new Map<string, Acc>();
  const ensure = (s: string): Acc => {
    let a = bySource.get(s);
    if (!a) { a = { bookings: 0, nights: 0, value: 0 }; bySource.set(s, a); }
    return a;
  };

  for (const r of reservations) {
    const a = ensure(r.source || UNKNOWN);
    a.bookings++;
    a.nights += r.totalNights;
    const g = Number(r.grandTotal), tot = Number(r.totalAmount), amt = Number(r.amount);
    a.value = r3(a.value + (g > 0 ? g : tot > 0 ? tot : amt));
  }

  const totalBookings = reservations.length;
  const sources: SourceRow[] = [...bySource.entries()].map(([source, a]) => ({
    source,
    bookings: a.bookings,
    nights: a.nights,
    value: a.value,
    avgValue: a.bookings > 0 ? r3(a.value / a.bookings) : 0,
    share: totalBookings > 0 ? r3(a.bookings / totalBookings) : 0,
  })).sort((x, y) => y.bookings - x.bookings || y.value - x.value);

  const value = r3(sources.reduce((s, x) => s + x.value, 0));
  const nights = sources.reduce((s, x) => s + x.nights, 0);
  const top = sources[0];

  return {
    kpis: {
      bookings: totalBookings,
      nights,
      value,
      avgValue: totalBookings > 0 ? r3(value / totalBookings) : 0,
      sourceCount: sources.length,
      topSource: top?.source ?? null,
      topBookings: top?.bookings ?? 0,
    },
    sources,
    rangeDays,
  };
}
