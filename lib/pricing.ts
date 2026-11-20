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
import { loadUnitPrices } from "@/lib/unit-prices";

// Price rows come from loadUnitPrices (lib/unit-prices.ts): the unit's own
// UnitPrice rows + virtual SEASONAL rows for the central Seasons that apply
// to it (Pricing Management). resolvePrice treats both identically.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApplicablePrice {
  priceId:     string;
  priceType:   "DEFAULT" | "SEASONAL";
  name:        string | null;
  dailyRate:   number;
  weeklyRate:  number | null;
  monthlyRate: number;
  priority:    number;
  /** Season's own weekend % override (null = use the organization's rule). */
  weekendAdjustPct: number | null;
  /** Season's own minimum nights (null = the organization's default). */
  minNights: number | null;
}

/**
 * Organization weekend pricing (Pricing → Stay rules). `days` are JS weekdays
 * (0 = Sunday … 6 = Saturday) of the NIGHT's start day — e.g. [4, 5] makes
 * Thursday and Friday nights weekend nights. `pct` adjusts the nightly rate
 * (+20 = 20% more, -10 = 10% less). Applies to nightly stays only; monthly
 * stays are priced from the monthly rate and never adjusted.
 */
export type WeekendRule = { days: number[]; pct: number };

export interface RangePriceResult {
  nights:          number;
  /** Minimum stay for these dates: the strictest rule among the seasons that
   *  price its nights, else the organization default (Pricing → Stay rules). */
  minNights:       number;
  totalAmount:     number;         // sum of daily rates
  currency:        "OMR";
  dailyBreakdown:  DayBreakdown[];
}

export interface DayBreakdown {
  date:       string;              // "YYYY-MM-DD"
  rate:       number;              // after the weekend adjustment
  weekend?:   boolean;             // true when a weekend % changed this night
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

/** Exported for the season migration's before/after equality check. */
export function resolvePrice(
  prices: {
    id: string; priceType: string; name: string | null;
    dailyRate: any; weeklyRate: any; monthlyRate: any;
    startDate: Date | null; endDate: Date | null;
    priority: number; isActive: boolean;
    weekendAdjustPct?: number | null;
    minNights?: number | null;
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
        weekendAdjustPct: null,
        minNights:   null,
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
    weekendAdjustPct: applicable.weekendAdjustPct ?? null,
    minNights:   applicable.minNights ?? null,
  };
}

/** Label added to weekend nights' price name (stored on segments/invoices). */
export const WEEKEND_LABEL = "Weekend";

/**
 * PURE: the nightly rate after the weekend rule. The night's weekday is read
 * in server-local time, like resolvePrice's day comparison (prod = UTC).
 * A season's own % (even 0) beats the organization's. Rounded to whole baisa
 * using integer arithmetic.
 */
export function applyWeekend(
  price: ApplicablePrice | null,
  night: Date,
  rule: WeekendRule | null | undefined,
): { rate: number; weekend: boolean; name: string | null } {
  if (!price) return { rate: 0, weekend: false, name: null };
  const plain = { rate: price.dailyRate, weekend: false, name: price.name };
  if (!rule || !rule.days.includes(night.getDay())) return plain;
  const pct = price.weekendAdjustPct ?? rule.pct;
  if (!pct) return plain;
  const baisa = Math.round(price.dailyRate * 1000);
  const adjusted = Math.max(0, Math.round((baisa * (100 + pct)) / 100));
  return {
    rate: adjusted / 1000,
    weekend: true,
    name: price.name ? `${price.name} · ${WEEKEND_LABEL}` : WEEKEND_LABEL,
  };
}

/** The organization's weekend rule (null when not configured). */
export function weekendRuleOf(org: { weekendDays: number[]; weekendAdjustPct: number } | null | undefined): WeekendRule | null {
  if (!org || org.weekendDays.length === 0) return null;
  return { days: org.weekendDays, pct: org.weekendAdjustPct };
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
    loadUnitPrices(unitId),
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
    loadUnitPrices(unitId),
    prisma.unit.findUnique({
      where: { id: unitId },
      select: { basePrice: true, property: { select: { organization: { select: { weekendDays: true, weekendAdjustPct: true, defaultMinNights: true } } } } },
    }),
  ]);
  const basePrice = unit ? Number(unit.basePrice) : null;
  const weekend = weekendRuleOf(unit?.property.organization);
  const orgMinNights = Math.max(1, unit?.property.organization.defaultMinNights ?? 1);
  let minNights = 0;

  const breakdown: DayBreakdown[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const p = resolvePrice(prices, cursor, basePrice);
    const night = applyWeekend(p, cursor, weekend);
    minNights = Math.max(minNights, p?.minNights ?? orgMinNights);
    breakdown.push({
      date:      toLocalDateString(cursor),
      rate:      night.rate,
      priceName: night.name,
      priceType: p?.priceType ?? "DEFAULT",
      ...(night.weekend ? { weekend: true } : {}),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    nights:         breakdown.length,
    minNights:      minNights || orgMinNights,
    // sum in whole baisa — weekend rates can carry 3 decimals
    totalAmount:    breakdown.reduce((s, d) => s + Math.round(d.rate * 1000), 0) / 1000,
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
    weekendAdjustPct?: number | null;
  }[],
  dateStr: string,
  weekend?: WeekendRule | null,
): { rate: number; name: string | null; priceType: "DEFAULT" | "SEASONAL"; weekend: boolean } | null {
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
  const night = applyWeekend(result, date, weekend);
  return { rate: night.rate, name: night.name, priceType: result.priceType, weekend: night.weekend };
}
