import { prisma } from "@/lib/prisma";

/**
 * Average Length of Stay — for reservations that ARRIVED in the period (startDate
 * within range, excluding CANCELLED / NO_SHOW), the average number of nights per
 * stay, grouped by Building → Stay. A reservation is attributed to the building
 * of its first unit (multi-building stays — rare — go to the first; noted).
 * Nights = the stored totalNights, falling back to endDate − startDate.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface LosStay {
  id: string;
  ref: string | null;
  guest: string;
  status: string;
  from: string;
  to: string;
  nights: number;
}
export interface LosBuilding {
  id: string;
  name: string;
  stayCount: number;
  totalNights: number;
  avgNights: number;
  stays: LosStay[];
}
export interface LosReport {
  kpis: {
    avgNights: number;
    stayCount: number;
    totalNights: number;
    longestNights: number;
    longestGuest: string | null;
    shortestNights: number;
    shortestGuest: string | null;
    buildingCount: number;
  };
  buildings: LosBuilding[];
  rangeDays: number;
}

export async function getAvgLengthOfStay(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<LosReport> {
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
      startDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } : {}),
    },
    select: {
      id: true, reservationNumber: true, status: true, startDate: true, endDate: true, totalNights: true,
      tenant: { select: { firstName: true, lastName: true } },
      unit: { select: { propertyId: true, property: { select: { name: true } } } },
      reservationUnits: { select: { unit: { select: { propertyId: true, property: { select: { name: true } } } } }, take: 1 },
    },
  });

  type BAcc = { id: string; name: string; nights: number; stays: LosStay[] };
  const buildings = new Map<string, BAcc>();
  const nameOf = (t?: { firstName: string | null; lastName: string | null } | null) =>
    t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—" : "—";

  let longest: { n: number; g: string | null } = { n: -1, g: null };
  let shortest: { n: number; g: string | null } = { n: Infinity, g: null };

  for (const res of reservations) {
    const ru = res.reservationUnits[0]?.unit;
    const prop = ru ?? res.unit;
    if (!prop?.propertyId) continue;
    const pid = prop.propertyId;
    if (propertyId && pid !== propertyId) continue;

    const nights = res.totalNights > 0
      ? res.totalNights
      : Math.max(0, Math.round((toDay(res.endDate) - toDay(res.startDate)) / DAY));

    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name: prop.property?.name ?? "—", nights: 0, stays: [] }; buildings.set(pid, b); }
    const guest = nameOf(res.tenant);
    b.nights += nights;
    b.stays.push({
      id: res.id, ref: res.reservationNumber, guest, status: res.status,
      from: res.startDate.toISOString(), to: res.endDate.toISOString(), nights,
    });

    if (nights > longest.n) longest = { n: nights, g: guest };
    if (nights < shortest.n) shortest = { n: nights, g: guest };
  }

  const buildingsOut: LosBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name,
    stayCount: b.stays.length,
    totalNights: b.nights,
    avgNights: b.stays.length > 0 ? r3(b.nights / b.stays.length) : 0,
    stays: b.stays.sort((a, c) => c.nights - a.nights),
  })).sort((a, c) => c.avgNights - a.avgNights);

  const stayCount = buildingsOut.reduce((s, b) => s + b.stayCount, 0);
  const totalNights = buildingsOut.reduce((s, b) => s + b.totalNights, 0);

  return {
    kpis: {
      avgNights: stayCount > 0 ? r3(totalNights / stayCount) : 0,
      stayCount,
      totalNights,
      longestNights: longest.n >= 0 ? longest.n : 0,
      longestGuest: longest.g,
      shortestNights: Number.isFinite(shortest.n) ? shortest.n : 0,
      shortestGuest: shortest.g,
      buildingCount: buildingsOut.length,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
