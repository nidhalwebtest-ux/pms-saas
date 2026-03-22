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

function resolvePrice(
  prices: {
    id: string; priceType: string; name: string | null;
    dailyRate: any; weeklyRate: any; monthlyRate: any;
    startDate: Date | null; endDate: Date | null;
    priority: number; isActive: boolean;
  }[],
  date: Date,
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
  if (!applicable) return null;

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
  const prices = await prisma.unitPrice.findMany({ where: { unitId } });
  return resolvePrice(prices, date);
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
  const prices = await prisma.unitPrice.findMany({ where: { unitId } });

  const breakdown: DayBreakdown[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const p = resolvePrice(prices, cursor);
    breakdown.push({
      date:      cursor.toISOString().slice(0, 10),
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
