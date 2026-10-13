/**
 * Binaya PMS subscription pricing — banded (marginal) per-unit pricing.
 *
 * Each rate applies ONLY to the units that fall inside its band, like tax
 * brackets. All money is integer baisa (1 OMR = 1000 baisa) — never floats.
 *
 * The previous flat tiers (Starter / Growth / Ultimate) are kept, hidden, in
 * components/marketing/LegacyFlatTierPricingSection.tsx.
 */

export interface PricingBand {
  /** First unit (1-based) covered by this band. */
  from: number;
  /** Last unit covered by this band; null = open-ended. */
  to: number | null;
  /** Price per unit per month, in baisa. */
  rateBaisa: number;
}

export const PRICING_BANDS: readonly PricingBand[] = [
  { from: 1, to: 20, rateBaisa: 1000 },
  { from: 21, to: 50, rateBaisa: 700 },
  { from: 51, to: null, rateBaisa: 500 },
];

/** Annual billing discount, whole percent. */
export const ANNUAL_DISCOUNT_PERCENT = 20;

export interface BandBreakdown {
  band: PricingBand;
  units: number;
  subtotalBaisa: number;
}

export interface MonthlyQuote {
  units: number;
  breakdown: BandBreakdown[];
  /** Monthly charge: the sum of the bands. */
  monthlyBaisa: number;
}

export interface BillingQuote extends MonthlyQuote {
  /** Total for 12 months at the full monthly price, before discount. */
  yearlyUndiscountedBaisa: number;
  /** Total for 12 months after the annual discount. */
  yearlyBaisa: number;
  /** Annual total spread over 12 months. */
  yearlyPerMonthBaisa: number;
  yearlySavingsBaisa: number;
}

function assertUnits(units: number): void {
  if (!Number.isInteger(units) || units < 0) {
    throw new RangeError(`units must be a non-negative integer, got ${units}`);
  }
}

export function quoteMonthly(units: number): MonthlyQuote {
  assertUnits(units);
  const breakdown: BandBreakdown[] = [];
  let monthlyBaisa = 0;
  for (const band of PRICING_BANDS) {
    const upper = band.to ?? Infinity;
    const inBand = Math.max(0, Math.min(units, upper) - (band.from - 1));
    if (inBand === 0) continue;
    const subtotalBaisa = inBand * band.rateBaisa;
    monthlyBaisa += subtotalBaisa;
    breakdown.push({ band, units: inBand, subtotalBaisa });
  }
  return { units, breakdown, monthlyBaisa };
}

export function calculateMonthlyBaisa(units: number): number {
  return quoteMonthly(units).monthlyBaisa;
}

export function quoteBilling(units: number): BillingQuote {
  const q = quoteMonthly(units);
  const yearlyUndiscountedBaisa = q.monthlyBaisa * 12;
  const yearlyBaisa = Math.round(
    (yearlyUndiscountedBaisa * (100 - ANNUAL_DISCOUNT_PERCENT)) / 100,
  );
  return {
    ...q,
    yearlyUndiscountedBaisa,
    yearlyBaisa,
    yearlyPerMonthBaisa: Math.round(yearlyBaisa / 12),
    yearlySavingsBaisa: yearlyUndiscountedBaisa - yearlyBaisa,
  };
}

/** 34000 → "34.000" (always 3 decimals, integer math only). */
export function formatBaisa(baisa: number): string {
  const sign = baisa < 0 ? "-" : "";
  const abs = Math.abs(baisa);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0");
  return `${sign}${whole}.${frac}`;
}
