/**
 * Reservation Engine — pure math/logic functions (no DB imports).
 * Safe to import in both Server Components/Actions and Client Components.
 *
 * Money: OMR uses 3 decimal places (1 OMR = 1000 baisa).
 * All arithmetic uses integer baisa rounding to avoid float drift.
 */

import type { DayBreakdown } from "@/lib/pricing";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceSegment {
  /** "YYYY-MM-DD" start of this segment */
  startDate:  string;
  /** "YYYY-MM-DD" last day of this segment (inclusive) */
  endDate:    string;
  nights:     number;
  ratePerNight: number;
  subtotal:   number;
  priceName:  string | null;
  priceType:  "DEFAULT" | "SEASONAL";
  /** "daily" | "monthly_partial" | "full_month" */
  segmentType: string;
}

export interface MonthBreakdown {
  label:       string;   // "March 2026"
  nights:      number;   // 30 for full months, remainder days otherwise
  ratePerNight: number;  // monthlyRate / 30
  monthlyRate: number;
  subtotal:    number;
  priceName:   string | null;
  priceType:   "DEFAULT" | "SEASONAL";
  segmentType: "full_month" | "monthly_partial";
}

export interface GrandTotalResult {
  totalAmount:    number;   // sum of unit subtotals before discount
  discountAmount: number;
  taxAmount:      number;   // 0 for now
  grandTotal:     number;   // totalAmount - discount + tax
}

// ── OMR rounding ──────────────────────────────────────────────────────────────

/** Round to 3 decimal places using integer baisa arithmetic. */
export function roundOMR(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ── Night calculation ─────────────────────────────────────────────────────────

/**
 * Calendar day difference: checkOut - checkIn in whole days.
 * checkIn = arrival day, checkOut = departure day (not charged).
 * e.g. Mar 1 → Mar 4 = 3 nights.
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = Date.UTC(checkIn.getFullYear(),  checkIn.getMonth(),  checkIn.getDate());
  const b = Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
  return Math.max(0, Math.round((b - a) / msPerDay));
}

// ── Month/day decomposition ───────────────────────────────────────────────────

export interface MonthsResult {
  fullMonths:    number;
  remainingDays: number;
  totalDays:     number;
}

/**
 * Decompose a stay into full calendar months + remaining days.
 * Uses a 30-day standard month for billing (industry standard for short-stay PMS).
 *
 * e.g. Jan 1 → Mar 16 = 2 full months + 15 remaining days (= 75 days total).
 */
export function calculateMonths(checkIn: Date, checkOut: Date): MonthsResult {
  const totalDays = calculateNights(checkIn, checkOut);
  const fullMonths    = Math.floor(totalDays / 30);
  const remainingDays = totalDays % 30;
  return { fullMonths, remainingDays, totalDays };
}

// ── Duration label ────────────────────────────────────────────────────────────

export function formatDuration(
  checkIn:  Date,
  checkOut: Date,
  rateType: "daily" | "monthly",
): string {
  const nights = calculateNights(checkIn, checkOut);
  if (rateType === "daily") {
    return `${nights} night${nights !== 1 ? "s" : ""}`;
  }
  const { fullMonths, remainingDays } = calculateMonths(checkIn, checkOut);
  const parts: string[] = [];
  if (fullMonths > 0)    parts.push(`${fullMonths} month${fullMonths !== 1 ? "s" : ""}`);
  if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "0 days";
}

// ── Daily breakdown → collapsed segments ─────────────────────────────────────

/**
 * Collapse a per-day breakdown (from getUnitPriceForRange) into segments of
 * consecutive days sharing the same price name & rate.
 * This powers the pricing summary table shown to the user.
 */
export function collapseToSegments(dailyBreakdown: DayBreakdown[]): PriceSegment[] {
  if (dailyBreakdown.length === 0) return [];

  const segments: PriceSegment[] = [];
  let cur = dailyBreakdown[0];
  let count = 1;
  let subtotal = cur.rate;

  for (let i = 1; i < dailyBreakdown.length; i++) {
    const d = dailyBreakdown[i];
    if (d.rate === cur.rate && d.priceName === cur.priceName && d.priceType === cur.priceType) {
      count++;
      subtotal += d.rate;
    } else {
      segments.push({
        startDate:   cur.date,
        endDate:     dailyBreakdown[i - 1].date,
        nights:      count,
        ratePerNight: cur.rate,
        subtotal:    roundOMR(subtotal),
        priceName:   cur.priceName,
        priceType:   cur.priceType,
        segmentType: "daily",
      });
      cur = d;
      count = 1;
      subtotal = d.rate;
    }
  }

  // push last segment
  segments.push({
    startDate:   cur.date,
    endDate:     dailyBreakdown[dailyBreakdown.length - 1].date,
    nights:      count,
    ratePerNight: cur.rate,
    subtotal:    roundOMR(subtotal),
    priceName:   cur.priceName,
    priceType:   cur.priceType,
    segmentType: "daily",
  });

  return segments;
}

// ── Monthly billing breakdown ─────────────────────────────────────────────────

/**
 * Build a monthly billing breakdown for a range.
 * Full months are billed at monthlyRate; remaining days at monthlyRate / 30.
 *
 * @param monthlyRate    - the applicable monthly rate (OMR)
 * @param priceName      - price label (null for default)
 * @param priceType      - "DEFAULT" | "SEASONAL"
 * @param fullMonths     - from calculateMonths()
 * @param remainingDays  - from calculateMonths()
 * @param checkIn        - to derive month labels
 */
export function buildMonthlyBreakdown(
  monthlyRate:   number,
  priceName:     string | null,
  priceType:     "DEFAULT" | "SEASONAL",
  fullMonths:    number,
  remainingDays: number,
  checkIn:       Date,
): MonthBreakdown[] {
  const result: MonthBreakdown[] = [];
  const dailyEquiv = roundOMR(monthlyRate / 30);

  // Full months
  for (let m = 0; m < fullMonths; m++) {
    const d = new Date(checkIn);
    d.setMonth(d.getMonth() + m);
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    result.push({
      label,
      nights:       30,
      ratePerNight: dailyEquiv,
      monthlyRate,
      subtotal:     roundOMR(monthlyRate),
      priceName,
      priceType,
      segmentType:  "full_month",
    });
  }

  // Remaining days
  if (remainingDays > 0) {
    const d = new Date(checkIn);
    d.setMonth(d.getMonth() + fullMonths);
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" }) + " (partial)";
    result.push({
      label,
      nights:       remainingDays,
      ratePerNight: dailyEquiv,
      monthlyRate,
      subtotal:     roundOMR(dailyEquiv * remainingDays),
      priceName,
      priceType,
      segmentType:  "monthly_partial",
    });
  }

  return result;
}

// ── Subtotal aggregation ──────────────────────────────────────────────────────

/** Sum an array of subtotals with OMR rounding. */
export function sumSubtotals(subtotals: number[]): number {
  const total = subtotals.reduce((acc, v) => acc + v, 0);
  return roundOMR(total);
}

// ── Grand total ───────────────────────────────────────────────────────────────

/**
 * Calculate the booking grand total from an array of unit subtotals and a discount.
 * Tax is 0 for now (configurable later via org settings).
 */
export function calculateGrandTotal(
  unitSubtotals:  number[],
  discountAmount: number = 0,
  taxRate:        number = 0,
): GrandTotalResult {
  const totalAmount    = sumSubtotals(unitSubtotals);
  const discount       = roundOMR(Math.max(0, discountAmount));
  const taxableAmount  = roundOMR(totalAmount - discount);
  const taxAmount      = roundOMR(taxableAmount * taxRate);
  const grandTotal     = roundOMR(taxableAmount + taxAmount);
  return { totalAmount, discountAmount: discount, taxAmount, grandTotal };
}

// ── Availability helpers ──────────────────────────────────────────────────────

/**
 * Check if two date ranges overlap.
 * Uses half-open intervals [start, end) — i.e., checkout day is NOT occupied.
 */
export function datesOverlap(
  aStart: Date, aEnd: Date,
  bStart: Date, bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Format a date as "YYYY-MM-DD" string (UTC-safe for date-only values).
 */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
