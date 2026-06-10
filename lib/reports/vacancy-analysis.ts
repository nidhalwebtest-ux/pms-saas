import { prisma } from "@/lib/prisma";

/**
 * Vacancy Analysis — the inverse of occupancy: where units sit EMPTY.
 *
 * For each unit we take the booked intervals within the period (same basis as
 * Occupancy: half-open [start, end), CANCELLED/NO_SHOW excluded, COMPLETED
 * counted), merge them, then take the COMPLEMENT inside [from, to) to get the
 * vacancy gaps — the actual empty date ranges. Vacant nights = period nights −
 * occupied nights. Estimated lost revenue = vacant nights × the unit's base
 * daily rate (an estimate; ignores seasonal overrides — labelled as such).
 *
 * A unit is "vacant at period end" when a gap runs to the end of the window
 * (i.e. it's empty as of the period's last day — "vacant now" for a live range).
 */

const DAY = 86_400_000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface VacGap {
  id: string;
  start: string;            // ISO
  end: string;              // ISO (exclusive)
  nights: number;
  lostRevenue: number;      // nights × dailyRate (estimate)
  isTrailing: boolean;      // gap runs to the end of the period
}
export interface VacUnit {
  id: string;
  name: string;
  dailyRate: number;
  occupiedNights: number;
  vacantNights: number;
  availableNights: number;  // = rangeDays
  vacancy: number;          // 0..1
  lostRevenue: number;
  vacantAtEnd: boolean;
  vacantSince: string | null; // ISO start of the trailing gap
  gaps: VacGap[];
}
export interface VacBuilding {
  id: string;
  name: string;
  unitCount: number;
  occupiedNights: number;
  vacantNights: number;
  availableNights: number;
  vacancy: number;          // 0..1
  lostRevenue: number;
  vacantUnitCount: number;  // units vacant at period end
  units: VacUnit[];
}
export interface VacReport {
  kpis: {
    vacancy: number;        // overall 0..1
    vacantNights: number;
    occupiedNights: number;
    availableNights: number;
    lostRevenue: number;
    unitCount: number;
    vacantUnitCount: number;
    buildingCount: number;
  };
  buildings: VacBuilding[];
  asOf: string;             // ISO — period end (last day), for "vacant as of" labels
  rangeDays: number;
}

export async function getVacancyAnalysis(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<VacReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const props = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(propertyId ? { id: propertyId } : {}) },
    select: { id: true, name: true, units: { select: { id: true, name: true, basePrice: true } } },
    orderBy: { name: "asc" },
  });

  // Seed every unit (so never-booked units show as 100% vacant).
  type UAcc = { id: string; name: string; rate: number; intervals: [number, number][] };
  type BAcc = { id: string; name: string; units: Map<string, UAcc> };
  const buildings = new Map<string, BAcc>();
  const unitToBuilding = new Map<string, string>();
  for (const p of props) {
    const b: BAcc = { id: p.id, name: p.name, units: new Map() };
    for (const u of p.units) {
      b.units.set(u.id, { id: u.id, name: u.name, rate: Number(u.basePrice), intervals: [] });
      unitToBuilding.set(u.id, p.id);
    }
    buildings.set(p.id, b);
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startDate: { lt: rangeToExclusive },
      endDate: { gt: rangeFrom },
    },
    select: {
      startDate: true, endDate: true, unitId: true,
      reservationUnits: { select: { unitId: true, effectiveCheckIn: true, effectiveCheckOut: true } },
    },
  });

  for (const res of reservations) {
    const segs: { unitId: string; start: Date; end: Date }[] = [];
    if (res.reservationUnits.length > 0) {
      for (const ru of res.reservationUnits) segs.push({ unitId: ru.unitId, start: ru.effectiveCheckIn ?? res.startDate, end: ru.effectiveCheckOut ?? res.endDate });
    } else if (res.unitId) {
      segs.push({ unitId: res.unitId, start: res.startDate, end: res.endDate });
    }
    for (const s of segs) {
      const pid = unitToBuilding.get(s.unitId);
      if (!pid) continue;
      const u = buildings.get(pid)?.units.get(s.unitId);
      if (!u) continue;
      const a = Math.max(fromMs, toDay(s.start));
      const b = Math.min(toExclusiveMs, toDay(s.end));
      if (b > a) u.intervals.push([a, b]);
    }
  }

  // Merge intervals → take complement within [fromMs, toExclusiveMs) → gaps.
  function gapsFor(intervals: [number, number][]): { occupied: number; gaps: [number, number][] } {
    const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [];
    for (const iv of sorted) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }
    const occupied = merged.reduce((s, m) => s + (m[1] - m[0]) / DAY, 0);
    const gaps: [number, number][] = [];
    let cursor = fromMs;
    for (const m of merged) {
      if (m[0] > cursor) gaps.push([cursor, m[0]]);
      cursor = Math.max(cursor, m[1]);
    }
    if (cursor < toExclusiveMs) gaps.push([cursor, toExclusiveMs]);
    return { occupied, gaps };
  }

  const buildingsOut: VacBuilding[] = [...buildings.values()].map((b) => {
    const units: VacUnit[] = [...b.units.values()].map((u) => {
      const { occupied, gaps } = gapsFor(u.intervals);
      const occupiedNights = Math.round(occupied);
      const vacantNights = Math.max(0, rangeDays - occupiedNights);
      const vacancy = rangeDays > 0 ? Math.min(1, vacantNights / rangeDays) : 0;
      const lostRevenue = r3(vacantNights * u.rate);
      const gapsOut: VacGap[] = gaps.map(([s, e]) => {
        const nights = Math.round((e - s) / DAY);
        const isTrailing = e === toExclusiveMs;
        return {
          id: `${u.id}:${s}`,
          start: new Date(s).toISOString(),
          end: new Date(e).toISOString(),
          nights,
          lostRevenue: r3(nights * u.rate),
          isTrailing,
        };
      });
      const trailing = gapsOut.find((g) => g.isTrailing) ?? null;
      return {
        id: u.id, name: u.name, dailyRate: u.rate,
        occupiedNights, vacantNights, availableNights: rangeDays, vacancy, lostRevenue,
        vacantAtEnd: !!trailing,
        vacantSince: trailing ? trailing.start : null,
        gaps: gapsOut.sort((a, c) => a.start.localeCompare(c.start)),
      };
    }).sort((a, c) => c.vacancy - a.vacancy || c.lostRevenue - a.lostRevenue);

    const unitCount = units.length;
    const vacantNights = units.reduce((s, u) => s + u.vacantNights, 0);
    const occupiedNights = units.reduce((s, u) => s + u.occupiedNights, 0);
    const availableNights = unitCount * rangeDays;
    return {
      id: b.id, name: b.name, unitCount,
      occupiedNights, vacantNights, availableNights,
      vacancy: availableNights > 0 ? Math.min(1, vacantNights / availableNights) : 0,
      lostRevenue: r3(units.reduce((s, u) => s + u.lostRevenue, 0)),
      vacantUnitCount: units.filter((u) => u.vacantAtEnd).length,
      units,
    };
  }).sort((a, c) => c.vacancy - a.vacancy || c.lostRevenue - a.lostRevenue);

  const availableNights = buildingsOut.reduce((s, b) => s + b.availableNights, 0);
  const vacantNights = buildingsOut.reduce((s, b) => s + b.vacantNights, 0);
  const occupiedNights = buildingsOut.reduce((s, b) => s + b.occupiedNights, 0);

  return {
    kpis: {
      vacancy: availableNights > 0 ? r3(vacantNights / availableNights) : 0,
      vacantNights,
      occupiedNights,
      availableNights,
      lostRevenue: r3(buildingsOut.reduce((s, b) => s + b.lostRevenue, 0)),
      unitCount: buildingsOut.reduce((s, b) => s + b.unitCount, 0),
      vacantUnitCount: buildingsOut.reduce((s, b) => s + b.vacantUnitCount, 0),
      buildingCount: buildingsOut.length,
    },
    buildings: buildingsOut,
    asOf: new Date(toDay(to)).toISOString(),
    rangeDays,
  };
}
