import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Effective price list per unit = its own UnitPrice rows (DEFAULT + any legacy
 * per-unit SEASONAL rows) + one virtual SEASONAL row per central Season that
 * applies to it (Pricing Management, Roadmap item 6).
 *
 * The virtual rows have exactly the UnitPrice shape, so lib/pricing.ts
 * (resolvePrice) prices them the same way as a per-unit season: highest
 * priority season covering the night wins, else DEFAULT, else unit.basePrice.
 *
 * A season applies to a unit when:
 *   - the unit's building is in season.propertyIds (empty = all buildings), and
 *   - the unit is not in season.excludedUnitIds, and
 *   - there's a rate for it: a per-unit override (SeasonRate.unitId) or a rate
 *     for its unit type (SeasonRate.unitType). The override wins.
 */

export type PriceRow = {
  id: string;
  priceType: string; // "DEFAULT" | "SEASONAL"
  name: string | null;
  dailyRate: Prisma.Decimal | number | string;
  weeklyRate: Prisma.Decimal | number | string | null;
  monthlyRate: Prisma.Decimal | number | string;
  startDate: Date | null;
  endDate: Date | null;
  priority: number;
  isActive: boolean;
  disallowMonthly: boolean;
  /** Set on virtual rows built from a central Season. */
  seasonId?: string;
};

type Db = Pick<PrismaClient, "unit" | "unitPrice" | "season">;

export const SEASON_ROW_PREFIX = "season:";

/** Effective price rows for each unit id (missing units map to []). */
export async function loadUnitPriceRows(unitIds: string[], db: Db = prisma): Promise<Map<string, PriceRow[]>> {
  const out = new Map<string, PriceRow[]>(unitIds.map((id) => [id, []]));
  if (unitIds.length === 0) return out;

  const [units, own] = await Promise.all([
    db.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitType: true, propertyId: true, property: { select: { organizationId: true } } },
    }),
    db.unitPrice.findMany({ where: { unitId: { in: unitIds } } }),
  ]);
  for (const p of own) out.get(p.unitId)?.push(p);

  const orgIds = [...new Set(units.map((u) => u.property.organizationId))];
  if (orgIds.length === 0) return out;
  const seasons = await db.season.findMany({ where: { organizationId: { in: orgIds } }, include: { rates: true } });
  if (seasons.length === 0) return out;

  for (const u of units) {
    const rows = out.get(u.id)!;
    rows.push(...seasonRowsForUnit({ ...u, organizationId: u.property.organizationId }, rows, seasons));
  }
  return out;
}

export type SeasonForMatch = {
  id: string;
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  priority: number;
  isActive: boolean;
  disallowMonthly: boolean;
  propertyIds: string[];
  excludedUnitIds: string[];
  rates: { unitId: string | null; unitType: string | null; dailyRate: Prisma.Decimal | number | string; weeklyRate: Prisma.Decimal | number | string | null; monthlyRate: Prisma.Decimal | number | string | null }[];
};

/**
 * PURE: the virtual SEASONAL rows central seasons contribute to one unit
 * (unit-tested in lib/unit-prices.test.ts). `ownRows` = the unit's UnitPrice
 * rows, used for the monthly-rate fallback.
 */
export function seasonRowsForUnit(
  unit: { id: string; unitType: string; propertyId: string; organizationId: string },
  ownRows: Pick<PriceRow, "priceType" | "monthlyRate">[],
  seasons: SeasonForMatch[],
): PriceRow[] {
  const def = ownRows.find((r) => r.priceType === "DEFAULT");
  const out: PriceRow[] = [];
  for (const s of seasons) {
    if (s.organizationId !== unit.organizationId) continue;
    if (s.propertyIds.length > 0 && !s.propertyIds.includes(unit.propertyId)) continue;
    if (s.excludedUnitIds.includes(unit.id)) continue;
    const rate = s.rates.find((r) => r.unitId === unit.id) ?? s.rates.find((r) => r.unitId === null && r.unitType === unit.unitType);
    if (!rate) continue;
    out.push({
      id: `${SEASON_ROW_PREFIX}${s.id}`,
      seasonId: s.id,
      priceType: "SEASONAL",
      name: s.name,
      dailyRate: rate.dailyRate,
      weeklyRate: rate.weeklyRate,
      // Monthly stays are priced from the DEFAULT row; a season's monthly rate
      // is informational — fall back to the default so the shape stays complete.
      monthlyRate: rate.monthlyRate ?? def?.monthlyRate ?? rate.dailyRate,
      startDate: s.startDate,
      endDate: s.endDate,
      priority: s.priority,
      isActive: s.isActive,
      disallowMonthly: s.disallowMonthly,
    });
  }
  return out;
}

/** Convenience for a single unit. */
export async function loadUnitPrices(unitId: string, db: Db = prisma): Promise<PriceRow[]> {
  return (await loadUnitPriceRows([unitId], db)).get(unitId) ?? [];
}
