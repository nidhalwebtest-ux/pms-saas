import { prisma } from "@/lib/prisma";

/**
 * Occupancy by Building — unit-night utilization over a period.
 *
 * Available unit-nights = (units in building) × (nights in period).
 * Occupied unit-nights  = Σ nights each unit was held by a non-cancelled
 *                         reservation, clamped to the period window.
 * Occupancy %           = occupied / available.
 *
 * Intervals are half-open [start, end) (checkout day frees the unit — standard
 * hotel turnover), matching lib/reservation-conflict.ts. A reservation occupies
 * a unit via the multi-unit join table (ReservationUnit, with mid-stay effective
 * dates) when present, otherwise via the legacy Reservation.unitId column.
 * CANCELLED / NO_SHOW never occupy; COMPLETED stays DID occupy and are counted.
 */

const DAY = 86_400_000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface OccStay {
  id: string;                 // `${reservationId}:${unitId}`
  reservationId: string;
  reservationRef: string | null;
  guest: string;
  status: string;             // reservation status (CONFIRMED / CHECKED_IN / COMPLETED / PENDING)
  from: string;               // ISO — occupied interval start, clamped to the period
  to: string;                 // ISO — occupied interval end (exclusive), clamped to the period
  nights: number;             // occupied nights within the period
}
export interface OccUnit {
  id: string;
  name: string;
  occupiedNights: number;
  availableNights: number;    // = rangeDays
  occupancy: number;          // 0..1
  stays: OccStay[];
}
export interface OccBuilding {
  id: string;
  name: string;
  unitCount: number;
  occupiedNights: number;
  availableNights: number;
  occupancy: number;          // 0..1
  units: OccUnit[];
}
export interface OccReport {
  kpis: {
    occupancy: number;        // overall 0..1
    occupiedNights: number;
    availableNights: number;
    vacantNights: number;
    unitCount: number;
    buildingCount: number;
    stayCount: number;
    topPerformer: string | null;
    topOccupancy: number;     // 0..1
  };
  buildings: OccBuilding[];
  rangeDays: number;
}

export async function getOccupancyByBuilding(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<OccReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  // Inventory: buildings + their units (pre-seed so vacant units show 0%).
  const props = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(propertyId ? { id: propertyId } : {}) },
    select: { id: true, name: true, units: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  type UAcc = { id: string; name: string; occupied: number; stays: Map<string, OccStay> };
  type BAcc = { id: string; name: string; units: Map<string, UAcc> };
  const buildings = new Map<string, BAcc>();
  const unitToBuilding = new Map<string, string>();
  for (const p of props) {
    const b: BAcc = { id: p.id, name: p.name, units: new Map() };
    for (const u of p.units) {
      b.units.set(u.id, { id: u.id, name: u.name, occupied: 0, stays: new Map() });
      unitToBuilding.set(u.id, p.id);
    }
    buildings.set(p.id, b);
  }

  // Reservations overlapping the window (half-open). Status filter excludes
  // CANCELLED / NO_SHOW; everything else (incl. COMPLETED) counts as occupying.
  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startDate: { lt: rangeToExclusive },
      endDate: { gt: rangeFrom },
    },
    select: {
      id: true, reservationNumber: true, status: true, startDate: true, endDate: true,
      unitId: true,
      tenant: { select: { firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true, effectiveCheckIn: true, effectiveCheckOut: true } },
    },
  });

  const nameOf = (t?: { firstName: string | null; lastName: string | null } | null) =>
    t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—" : "—";

  for (const res of reservations) {
    const guest = nameOf(res.tenant);
    // Resolve which units this reservation holds, and over what interval.
    const segments: { unitId: string; start: Date; end: Date }[] = [];
    if (res.reservationUnits.length > 0) {
      for (const ru of res.reservationUnits) {
        segments.push({ unitId: ru.unitId, start: ru.effectiveCheckIn ?? res.startDate, end: ru.effectiveCheckOut ?? res.endDate });
      }
    } else if (res.unitId) {
      segments.push({ unitId: res.unitId, start: res.startDate, end: res.endDate });
    }

    for (const seg of segments) {
      const pid = unitToBuilding.get(seg.unitId);
      if (!pid) continue;                       // unit not in scope (filtered/archived building)
      const b = buildings.get(pid);
      const u = b?.units.get(seg.unitId);
      if (!b || !u) continue;

      const startMs = Math.max(fromMs, toDay(seg.start));
      const endMs = Math.min(toExclusiveMs, toDay(seg.end));
      const nights = Math.max(0, Math.round((endMs - startMs) / DAY));
      if (nights <= 0) continue;

      u.occupied += nights;
      const key = `${res.id}:${seg.unitId}`;
      // Collapse duplicate segments for the same (reservation, unit) into one row.
      const existing = u.stays.get(key);
      if (existing) {
        existing.nights += nights;
      } else {
        u.stays.set(key, {
          id: key, reservationId: res.id, reservationRef: res.reservationNumber,
          guest, status: res.status,
          from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString(),
          nights,
        });
      }
    }
  }

  const buildingsOut: OccBuilding[] = [...buildings.values()].map((b) => {
    const units: OccUnit[] = [...b.units.values()].map((u) => ({
      id: u.id, name: u.name,
      occupiedNights: u.occupied,
      availableNights: rangeDays,
      occupancy: rangeDays > 0 ? Math.min(1, u.occupied / rangeDays) : 0,
      stays: [...u.stays.values()].sort((a, c) => a.from.localeCompare(c.from)),
    })).sort((a, c) => c.occupancy - a.occupancy);

    const unitCount = units.length;
    const availableNights = unitCount * rangeDays;
    const occupiedNights = units.reduce((s, u) => s + u.occupiedNights, 0);
    return {
      id: b.id, name: b.name, unitCount,
      occupiedNights, availableNights,
      occupancy: availableNights > 0 ? Math.min(1, occupiedNights / availableNights) : 0,
      units,
    };
  }).sort((a, c) => c.occupancy - a.occupancy);

  const availableNights = buildingsOut.reduce((s, b) => s + b.availableNights, 0);
  const occupiedNights = buildingsOut.reduce((s, b) => s + b.occupiedNights, 0);
  const unitCount = buildingsOut.reduce((s, b) => s + b.unitCount, 0);
  const stayCount = buildingsOut.reduce((s, b) => s + b.units.reduce((t, u) => t + u.stays.length, 0), 0);
  const top = buildingsOut.find((b) => b.unitCount > 0) ?? null;

  return {
    kpis: {
      occupancy: availableNights > 0 ? r3(occupiedNights / availableNights) : 0,
      occupiedNights,
      availableNights,
      vacantNights: Math.max(0, availableNights - occupiedNights),
      unitCount,
      buildingCount: buildingsOut.length,
      stayCount,
      topPerformer: top?.name ?? null,
      topOccupancy: top?.occupancy ?? 0,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
