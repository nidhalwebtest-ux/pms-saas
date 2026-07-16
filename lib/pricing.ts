/**
 * Pricing utility functions.
 *
 * Used by:
 *  - Unit Details pricing section (server)
 *  - Reservation creation / calculation (Sprint 2)
 *  - /api/units/[unitId]/prices/calculate
 *
 * Rules:
 *  1. Every unit should have exactly one DEFAULT price.
 *  2. SEASONAL prices override DEFAULT for their date range.
 *  3. When multiple SEASONAL prices overlap, highest `priority` wins.
 *  4. Only `isActive = true` prices are considered.
 */

import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApplicablePrice {
  priceId:     string;
  priceType:   "DEFAULT" | "SEASONAL";
  name:        string | null;
  dailyRate:   number;
  weeklyRate:  number | null;
  monthlyRate: number;
  priority:    number;
}

export interface RangePriceResult {
  nights:          number;
  totalAmount:     number;         // sum of daily rates
  currency:        "OMR";
  dailyBreakdown:  DayBreakdown[];
}

export interface DayBreakdown {
  date:       string;              // "YYYY-MM-DD"
  rate:       number;
  priceName:  string | null;       // null = default price
  priceType:  "DEFAULT" | "SEASONAL";
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Format a Date as YYYY-MM-DD from its LOCAL calendar day. The pricing loop
 * normalises each night's cursor to local midnight (setHours) and resolvePrice
 * compares in local time, so the label must use the local day too. Using
 * toISOString() here reprints the instant in UTC, which shifts the date back a
 * day in positive-offset timezones (e.g. Gulf +4) — the source of the off-by-one
 * segment dates. (No effect on UTC servers, where local == UTC.)
 */
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolvePrice(
  prices: {
    id: string; priceType: string; name: string | null;
    dailyRate: any; weeklyRate: any; monthlyRate: any;
    startDate: Date | null; endDate: Date | null;
    priority: number; isActive: boolean;
  }[],
  date: Date,
  basePrice?: number | null,
): ApplicablePrice | null {
  const active = prices.filter((p) => p.isActive);
  const defaultPrice = active.find((p) => p.priceType === "DEFAULT");

  // Day boundary: compare date-only (ignore time)
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const seasonal = active
    .filter((p) => {
      if (p.priceType !== "SEASONAL" || !p.startDate || !p.endDate) return false;
      const s = new Date(p.startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(p.endDate);   e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    })
    .sort((a, b) => b.priority - a.priority);

  const applicable = seasonal[0] ?? defaultPrice ?? null;
  if (!applicable) {
    // No configured DEFAULT/SEASONAL UnitPrice for this date → fall back to the
    // unit's base (daily) price so a normally-created unit still prices its
    // daily rate instead of 0.00. (Monthly rates must be configured per unit.)
    if (basePrice != null && basePrice > 0) {
      return {
        priceId:     "base",
        priceType:   "DEFAULT",
        name:        null,
        dailyRate:   basePrice,
        weeklyRate:  null,
        monthlyRate: basePrice,
        priority:    0,
      };
    }
    return null;
  }

  return {
    priceId:     applicable.id,
    priceType:   applicable.priceType as "DEFAULT" | "SEASONAL",
    name:        applicable.name,
    dailyRate:   Number(applicable.dailyRate),
    weeklyRate:  applicable.weeklyRate != null ? Number(applicable.weeklyRate) : null,
    monthlyRate: Number(applicable.monthlyRate),
    priority:    applicable.priority,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the applicable price for a single date.
 * Returns null if the unit has no prices configured.
 */
export async function getUnitPriceForDate(
  unitId: string,
  date:   Date,
): Promise<ApplicablePrice | null> {
  const [prices, unit] = await Promise.all([
    prisma.unitPrice.findMany({ where: { unitId } }),
    prisma.unit.findUnique({ where: { id: unitId }, select: { basePrice: true } }),
  ]);
  return resolvePrice(prices, date, unit ? Number(unit.basePrice) : null);
}

/**
 * Calculates total cost for a date range (startDate inclusive, endDate exclusive).
 * Each night is priced at the daily rate applicable on that night's start day.
 */
export async function getUnitPriceForRange(
  unitId:    string,
  startDate: Date,
  endDate:   Date,
): Promise<RangePriceResult> {
  const [prices, unit] = await Promise.all([
    prisma.unitPrice.findMany({ where: { unitId } }),
    prisma.unit.findUnique({ where: { id: unitId }, select: { basePrice: true } }),
  ]);
  const basePrice = unit ? Number(unit.basePrice) : null;

  const breakdown: DayBreakdown[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const p = resolvePrice(prices, cursor, basePrice);
    breakdown.push({
      date:      toLocalDateString(cursor),
      rate:      p?.dailyRate ?? 0,
      priceName: p?.name ?? null,
      priceType: p?.priceType ?? "DEFAULT",
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    nights:         breakdown.length,
    totalAmount:    breakdown.reduce((s, d) => s + d.rate, 0),
    currency:       "OMR",
    dailyBreakdown: breakdown,
  };
}

/**
 * Client-safe resolver: takes already-fetched prices (serialised) and a date string.
 * Used by the 30-day price calendar to avoid a server round-trip per cell.
 */
export function resolveClientPrice(
  prices: {
    id: string; priceType: string; name: string | null;
    dailyRate: string; weeklyRate: string | null; monthlyRate: string;
    startDate: string | null; endDate: string | null;
    priority: number; isActive: boolean;
  }[],
  dateStr: string,
): { rate: number; name: string | null; priceType: "DEFAULT" | "SEASONAL" } | null {
  const date = new Date(dateStr);
  const result = resolvePrice(
    prices.map((p) => ({
      ...p,
      dailyRate:   p.dailyRate,
      weeklyRate:  p.weeklyRate,
      monthlyRate: p.monthlyRate,
      startDate:   p.startDate ? new Date(p.startDate) : null,
      endDate:     p.endDate   ? new Date(p.endDate)   : null,
    })),
    date,
  );
  if (!result) return null;
  return { rate: result.dailyRate, name: result.name, priceType: result.priceType };
}
