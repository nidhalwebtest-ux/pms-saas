import { prisma } from "@/lib/prisma";

/**
 * Occupancy Trend — occupancy % bucketed over time (day / week / month).
 *
 * Same unit-night basis as Occupancy by Building (half-open [start, end)
 * intervals; CANCELLED / NO_SHOW excluded, COMPLETED counted), but instead of
 * grouping by building it splits the period into time buckets and reports the
 * occupancy ratio of each bucket so the trend can be charted.
 *
 * Granularity auto-picks from the range (≤31d → day, ≤120d → week, else month)
 * and can be overridden via the `bucket` param.
 */

const DAY = 86_400_000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type Granularity = "day" | "week" | "month";

export interface OccTrendBucket {
  key: string;              // ISO bucket start (stable id)
  start: string;            // ISO — bucket start (clamped to period)
  end: string;              // ISO — bucket end (exclusive, clamped to period)
  occupiedNights: number;
  availableNights: number;
  occupancy: number;        // 0..1
}
export interface OccTrendReport {
  granularity: Granularity;
  buckets: OccTrendBucket[];
  kpis: {
    avgOccupancy: number;   // overall occupied/available, 0..1
    peakOccupancy: number;
    peakKey: string | null; // bucket start ISO of the peak
    lowOccupancy: number;
    lowKey: string | null;
    occupiedNights: number;
    availableNights: number;
    unitCount: number;
    deltaPts: number;       // (last bucket − first bucket) occupancy, in percentage points
  };
  rangeDays: number;
}

function pickGranularity(rangeDays: number, override?: string): Granularity {
  if (override === "day" || override === "week" || override === "month") return override;
  if (rangeDays <= 31) return "day";
  if (rangeDays <= 120) return "week";
  return "month";
}

function buildBuckets(fromMs: number, toExclusiveMs: number, gran: Granularity): { startMs: number; endMs: number }[] {
  const out: { startMs: number; endMs: number }[] = [];
  if (gran === "month") {
    let cur = Date.UTC(new Date(fromMs).getUTCFullYear(), new Date(fromMs).getUTCMonth(), 1);
    while (cur < toExclusiveMs) {
      const d = new Date(cur);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      out.push({ startMs: Math.max(cur, fromMs), endMs: Math.min(next, toExclusiveMs) });
      cur = next;
    }
  } else {
    const step = (gran === "week" ? 7 : 1) * DAY;
    for (let s = fromMs; s < toExclusiveMs; s += step) {
      out.push({ startMs: s, endMs: Math.min(s + step, toExclusiveMs) });
    }
  }
  return out;
}

export async function getOccupancyTrend(params: {
  orgId: string; from: Date; to: Date; propertyId?: string; bucket?: string;
}): Promise<OccTrendReport> {
  const { orgId, from, to, propertyId, bucket } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);
  const gran = pickGranularity(rangeDays, bucket);
  const buckets = buildBuckets(fromMs, toExclusiveMs, gran);

  // In-scope inventory (units belonging to non-archived properties).
  const props = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(propertyId ? { id: propertyId } : {}) },
    select: { units: { select: { id: true } } },
  });
  const inScopeUnits = new Set<string>();
  for (const p of props) for (const u of p.units) inScopeUnits.add(u.id);
  const unitCount = inScopeUnits.size;

  // Reservations overlapping the window (half-open), excluding cancelled/no-show.
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

  // Flatten to occupied intervals (clamped per-day), only for in-scope units.
  const intervals: { startMs: number; endMs: number }[] = [];
  for (const res of reservations) {
    const segs: { unitId: string; start: Date; end: Date }[] = [];
    if (res.reservationUnits.length > 0) {
      for (const ru of res.reservationUnits) segs.push({ unitId: ru.unitId, start: ru.effectiveCheckIn ?? res.startDate, end: ru.effectiveCheckOut ?? res.endDate });
    } else if (res.unitId) {
      segs.push({ unitId: res.unitId, start: res.startDate, end: res.endDate });
    }
    for (const s of segs) {
      if (!inScopeUnits.has(s.unitId)) continue;
      const startMs = Math.max(fromMs, toDay(s.start));
      const endMs = Math.min(toExclusiveMs, toDay(s.end));
      if (endMs > startMs) intervals.push({ startMs, endMs });
    }
  }

  // Accumulate occupied nights into buckets by interval∩bucket overlap.
  const occByBucket = new Array(buckets.length).fill(0);
  for (const iv of intervals) {
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (iv.endMs <= b.startMs || iv.startMs >= b.endMs) continue;
      const overlap = Math.min(iv.endMs, b.endMs) - Math.max(iv.startMs, b.startMs);
      if (overlap > 0) occByBucket[i] += overlap / DAY;
    }
  }

  const bucketsOut: OccTrendBucket[] = buckets.map((b, i) => {
    const bucketDays = (b.endMs - b.startMs) / DAY;
    const availableNights = unitCount * bucketDays;
    const occupiedNights = Math.round(occByBucket[i]);
    return {
      key: new Date(b.startMs).toISOString(),
      start: new Date(b.startMs).toISOString(),
      end: new Date(b.endMs).toISOString(),
      occupiedNights,
      availableNights,
      occupancy: availableNights > 0 ? Math.min(1, occByBucket[i] / availableNights) : 0,
    };
  });

  const occupiedNights = bucketsOut.reduce((s, b) => s + b.occupiedNights, 0);
  const availableNights = bucketsOut.reduce((s, b) => s + b.availableNights, 0);
  const withInventory = bucketsOut.filter((b) => b.availableNights > 0);
  let peak = withInventory[0] ?? null, low = withInventory[0] ?? null;
  for (const b of withInventory) {
    if (b.occupancy > (peak?.occupancy ?? -1)) peak = b;
    if (b.occupancy < (low?.occupancy ?? 2)) low = b;
  }
  const first = withInventory[0], last = withInventory[withInventory.length - 1];
  const deltaPts = first && last ? r3((last.occupancy - first.occupancy) * 100) : 0;

  return {
    granularity: gran,
    buckets: bucketsOut,
    kpis: {
      avgOccupancy: availableNights > 0 ? r3(occupiedNights / availableNights) : 0,
      peakOccupancy: peak?.occupancy ?? 0,
      peakKey: peak?.key ?? null,
      lowOccupancy: low?.occupancy ?? 0,
      lowKey: low?.key ?? null,
      occupiedNights,
      availableNights,
      unitCount,
      deltaPts,
    },
    rangeDays,
  };
}
