import { prisma } from "@/lib/prisma";
import {
  calculateNights,
  countCalendarMonths,
  buildCalendarMonthBreakdown,
  collapseToSegments,
  roundOMR,
  sumSubtotals,
} from "@/lib/reservation-engine";
import { getUnitPriceForRange } from "@/lib/pricing";

// A persisted snapshot of each price segment of a stay (e.g. 3 nights DEFAULT +
// 4 nights Khareef SEASONAL). Source of truth for invoices/receipts/reports so
// they don't recompute from prices+dates later (QA #28).
export type PricingSegment = {
  label:             string | null;   // e.g. "March 2026" (monthly) — null for daily
  startDate:         string | null;   // ISO date (daily segments)
  endDate:           string | null;   // ISO date (daily segments)
  nights:            number;
  rateAmount:        number;          // per-night (daily) or monthly rate (monthly)
  rateSource:        string;          // default_price | seasonal_price | manual_override
  seasonalPriceName: string | null;
  subtotal:          number;
};

export type UnitPricing = {
  unitId:            string;
  rateType:          string;
  rateAmount:        number;
  rateSource:        string;
  seasonalPriceName: string | null;
  nights:            number;
  subtotal:          number;
  pricingSegments:   PricingSegment[];
};

export type UnitOverride = { unitId: string; rateAmount: number };

/**
 * Returns the SEASONAL price record that blocks monthly bookings for any of the
 * given units over [startDate, endDate), or null if none (QA #27). Used to
 * reject monthly reservations during seasons flagged `disallowMonthly`.
 */
export async function findMonthlyBlock(
  unitIds:   string[],
  startDate: Date,
  endDate:   Date,
): Promise<{ unitId: string; name: string | null } | null> {
  const blocked = await prisma.unitPrice.findFirst({
    where: {
      unitId:          { in: unitIds },
      priceType:       "SEASONAL",
      isActive:        true,
      disallowMonthly: true,
      startDate:       { lt: endDate },
      endDate:         { gt: startDate },
    },
    select: { unitId: true, name: true },
  });
  return blocked;
}

/**
 * Compute per-unit pricing + the persisted segment breakdown for a stay.
 * Shared by the create (POST) and edit (PUT) reservation handlers so both
 * produce identical pricing/segment snapshots (QA #28 / #30).
 *
 * `unitOverrides` carries manual per-night/per-month rates from the booking UI.
 */
export async function computeUnitPricings(
  unitIds:       string[],
  rt:            "daily" | "monthly",
  startDate:     Date,
  endDate:       Date,
  unitOverrides: UnitOverride[] = [],
): Promise<UnitPricing[]> {
  const totalNightsVal = calculateNights(startDate, endDate);
  const calMonths      = countCalendarMonths(startDate, endDate);
  const unitPricings: UnitPricing[] = [];

  for (const unitId of unitIds) {
    const override = unitOverrides.find((o) => o.unitId === unitId);

    if (rt === "daily") {
      if (override && override.rateAmount > 0) {
        const subtotal = roundOMR(override.rateAmount * totalNightsVal);
        unitPricings.push({
          unitId,
          rateType:          "daily",
          rateAmount:        override.rateAmount,
          rateSource:        "manual_override",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal,
          pricingSegments: [{
            label:             null,
            startDate:         startDate.toISOString(),
            endDate:           endDate.toISOString(),
            nights:            totalNightsVal,
            rateAmount:        override.rateAmount,
            rateSource:        "manual_override",
            seasonalPriceName: null,
            subtotal,
          }],
        });
      } else {
        const priceResult = await getUnitPriceForRange(unitId, startDate, endDate);
        const segments    = collapseToSegments(priceResult.dailyBreakdown);
        const subtotal    = sumSubtotals(segments.map((s) => s.subtotal));
        const firstSeg    = segments[0];
        unitPricings.push({
          unitId,
          rateType:          "daily",
          rateAmount:        firstSeg?.ratePerNight ?? 0,
          rateSource:        firstSeg?.priceType === "SEASONAL" ? "seasonal_price" : "default_price",
          seasonalPriceName: firstSeg?.priceName ?? null,
          nights:            totalNightsVal,
          subtotal,
          pricingSegments: segments.map((s) => ({
            label:             null,
            startDate:         s.startDate,
            endDate:           s.endDate,
            nights:            s.nights,
            rateAmount:        s.ratePerNight,
            rateSource:        s.priceType === "SEASONAL" ? "seasonal_price" : "default_price",
            seasonalPriceName: s.priceName,
            subtotal:          s.subtotal,
          })),
        });
      }
    } else {
      // Monthly — calendar month standard
      if (override && override.rateAmount > 0) {
        const subtotal = roundOMR(override.rateAmount * calMonths);
        unitPricings.push({
          unitId,
          rateType:          "monthly",
          rateAmount:        override.rateAmount,
          rateSource:        "manual_override",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal,
          pricingSegments: [{
            label:             null,
            startDate:         startDate.toISOString(),
            endDate:           endDate.toISOString(),
            nights:            totalNightsVal,
            rateAmount:        override.rateAmount,
            rateSource:        "manual_override",
            seasonalPriceName: null,
            subtotal,
          }],
        });
      } else {
        const prices       = await prisma.unitPrice.findMany({ where: { unitId, isActive: true } });
        const defaultPrice = prices.find((p) => p.priceType === "DEFAULT");
        const monthlyRate  = defaultPrice ? Number(defaultPrice.monthlyRate) : 0;
        const segments     = buildCalendarMonthBreakdown(
          startDate, calMonths, monthlyRate, defaultPrice?.name ?? null, "DEFAULT",
        );
        unitPricings.push({
          unitId,
          rateType:          "monthly",
          rateAmount:        monthlyRate,
          rateSource:        "default_price",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal:          sumSubtotals(segments.map((s) => s.subtotal)),
          pricingSegments: segments.map((s) => ({
            label:             s.label,
            startDate:         null,
            endDate:           null,
            nights:            s.nights,
            rateAmount:        s.monthlyRate,
            rateSource:        s.priceType === "SEASONAL" ? "seasonal_price" : "default_price",
            seasonalPriceName: s.priceType === "SEASONAL" ? s.priceName : null,
            subtotal:          s.subtotal,
          })),
        });
      }
    }
  }

  return unitPricings;
}
