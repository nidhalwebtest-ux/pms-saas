/**
 * Stay rules (Pricing → Stay rules, Roadmap item 6 step 5) — PURE and
 * client-safe (no Prisma), unit-tested in lib/unit-prices.test.ts.
 *
 * Long-stay discount: tiers like [{ minNights: 7, percent: 5 }, { minNights: 28, percent: 15 }].
 * The highest tier a NIGHTLY stay reaches applies, as a separate discount on the
 * reservation (Reservation.discountAmount) — nightly rates are never changed.
 * Monthly stays never get it (they're already on the monthly rate).
 *
 * Minimum nights is computed by the pricing engine (getUnitPriceForRange →
 * minNights), because it depends on which season prices each night.
 */

export type LongStayTier = { minNights: number; percent: number };

export const MAX_TIERS = 5;

/** Sanitise the stored JSON (Organization.longStayDiscounts) into sorted tiers. */
export function parseLongStayTiers(raw: unknown): LongStayTier[] {
  if (!Array.isArray(raw)) return [];
  const byNights = new Map<number, number>();
  for (const t of raw) {
    const n = Math.round(Number((t as LongStayTier)?.minNights));
    const p = Number((t as LongStayTier)?.percent);
    if (!Number.isFinite(n) || n < 2 || n > 365) continue;
    if (!Number.isFinite(p) || p <= 0 || p > 90) continue;
    byNights.set(n, Math.round(p * 10) / 10);
  }
  return [...byNights.entries()].map(([minNights, percent]) => ({ minNights, percent })).sort((a, b) => a.minNights - b.minNights);
}

/** The tier a stay of `nights` reaches (highest minNights ≤ nights), or null. */
export function longStayTierFor(nights: number, tiers: LongStayTier[]): LongStayTier | null {
  let hit: LongStayTier | null = null;
  for (const t of tiers) if (nights >= t.minNights && (!hit || t.minNights > hit.minNights)) hit = t;
  return hit;
}

/**
 * Discount for a nightly stay: `percent` of the accommodation subtotal, in whole
 * baisa (integer arithmetic). Returns 0 / null tier for monthly stays.
 */
export function longStayDiscount(
  subtotal: number,
  nights: number,
  tiers: LongStayTier[],
  rateType: "daily" | "monthly" = "daily",
): { amount: number; tier: LongStayTier | null } {
  if (rateType !== "daily" || subtotal <= 0) return { amount: 0, tier: null };
  const tier = longStayTierFor(nights, tiers);
  if (!tier) return { amount: 0, tier: null };
  const baisa = Math.round(subtotal * 1000);
  return { amount: Math.round((baisa * tier.percent) / 100) / 1000, tier };
}
