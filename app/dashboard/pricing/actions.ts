"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { hasAccess } from "@/lib/access";
import { UNIT_TYPES } from "@/lib/pricing-management";
import { publicOrgTag } from "@/lib/public-site/data";
import { parseLongStayTiers, MAX_TIERS, type LongStayTier } from "@/lib/stay-rules";

/**
 * Pricing Management server actions (Roadmap item 6).
 * Permission: editing prices = units EDIT (prices belong to units).
 * Money arrives as text and is validated to ≤ 3 decimals, stored as Decimal —
 * never parsed through floating point.
 */

export type PricingResult = { ok: true; id?: string } | { ok: false; error: string };

/** "45" / "45.5" / "45.500" → Decimal; "" → null; invalid → undefined. */
function money(raw: string | null | undefined): Prisma.Decimal | null | undefined {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(s)) return undefined;
  return new Prisma.Decimal(s);
}

async function editor() {
  try {
    const u = await requireOrgUser();
    if (!(await hasAccess("units", "EDIT"))) return null;
    return u;
  } catch {
    return null;
  }
}

function refresh(orgId: string) {
  revalidatePath("/dashboard/pricing", "layout");
  revalidatePath("/dashboard/units", "layout");
  // public booking site caches "from" prices per org
  updateTag(publicOrgTag(orgId));
}

// ── Seasons ──────────────────────────────────────────────────────────────────

export type SeasonInput = {
  id?: string;
  name: string;
  nameAr: string;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string;   // YYYY-MM-DD (inclusive)
  priority: number;
  isActive: boolean;
  disallowMonthly: boolean;
  color: string;
  propertyIds: string[];
  excludedUnitIds: string[];
  /** One per unit type that the season covers; daily required. */
  typeRates: { unitType: string; daily: string; weekly: string; monthly: string }[];
  /** Per-unit overrides of the type rate. */
  unitRates: { unitId: string; daily: string; weekly: string; monthly: string }[];
  minNights: number | null;
  weekendAdjustPct: number | null;
};

/** Dates are stored exactly like existing UnitPrice seasons: UTC midnight of the
 *  start day and UTC 23:59:59.999 of the (inclusive) end day. resolvePrice
 *  compares calendar days in server time, and production runs in UTC. */
const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const dayEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999Z`);

export async function saveSeason(input: SeasonInput): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  const orgId = u.organizationId;

  const name = input.name.trim();
  if (!name) return { ok: false, error: t("nameRequired") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.endDate < input.startDate) {
    return { ok: false, error: t("dates") };
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return { ok: false, error: t("color") };
  const priority = Math.round(input.priority);
  if (!Number.isFinite(priority) || priority < 0 || priority > 1000) return { ok: false, error: t("priority") };
  const minNights = input.minNights === null ? null : Math.round(input.minNights);
  if (minNights !== null && (!Number.isFinite(minNights) || minNights < 1 || minNights > 365)) return { ok: false, error: t("minNights") };
  const weekendAdjustPct = input.weekendAdjustPct === null ? null : Math.round(input.weekendAdjustPct);
  if (weekendAdjustPct !== null && (!Number.isFinite(weekendAdjustPct) || weekendAdjustPct < -90 || weekendAdjustPct > 500)) return { ok: false, error: t("weekendPct") };

  // ownership: buildings + units must belong to this org
  const [props, units] = await Promise.all([
    prisma.property.findMany({ where: { organizationId: orgId, id: { in: input.propertyIds } }, select: { id: true } }),
    prisma.unit.findMany({
      where: { property: { organizationId: orgId }, id: { in: [...input.excludedUnitIds, ...input.unitRates.map((r) => r.unitId)] } },
      select: { id: true },
    }),
  ]);
  if (props.length !== new Set(input.propertyIds).size) return { ok: false, error: t("forbidden") };
  const ownUnits = new Set(units.map((x) => x.id));
  if ([...input.excludedUnitIds, ...input.unitRates.map((r) => r.unitId)].some((id) => !ownUnits.has(id))) return { ok: false, error: t("forbidden") };

  const rates: Prisma.SeasonRateCreateManyInput[] = [];
  const pushRate = (key: { unitType?: string; unitId?: string }, r: { daily: string; weekly: string; monthly: string }) => {
    const daily = money(r.daily), weekly = money(r.weekly), monthly = money(r.monthly);
    if (daily === undefined || weekly === undefined || monthly === undefined) return t("money");
    if (daily === null) return null; // row not filled → not part of the season
    rates.push({ seasonId: "", ...key, dailyRate: daily, weeklyRate: weekly, monthlyRate: monthly });
    return null;
  };
  for (const r of input.typeRates) {
    if (!UNIT_TYPES.includes(r.unitType as (typeof UNIT_TYPES)[number])) return { ok: false, error: t("forbidden") };
    const err = pushRate({ unitType: r.unitType }, r);
    if (err) return { ok: false, error: err };
  }
  for (const r of input.unitRates) {
    const err = pushRate({ unitId: r.unitId }, r);
    if (err) return { ok: false, error: err };
  }
  if (rates.length === 0) return { ok: false, error: t("noRates") };

  const data = {
    name,
    nameAr: input.nameAr.trim() || null,
    startDate: dayStart(input.startDate),
    endDate: dayEnd(input.endDate),
    priority,
    isActive: input.isActive,
    disallowMonthly: input.disallowMonthly,
    color: input.color,
    propertyIds: [...new Set(input.propertyIds)],
    excludedUnitIds: [...new Set(input.excludedUnitIds)],
    minNights,
    weekendAdjustPct,
  };

  let id = input.id;
  await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.season.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
      if (!existing) throw new Error("not found");
      await tx.season.update({ where: { id }, data });
      await tx.seasonRate.deleteMany({ where: { seasonId: id } });
    } else {
      id = (await tx.season.create({ data: { ...data, organizationId: orgId }, select: { id: true } })).id;
    }
    await tx.seasonRate.createMany({ data: rates.map((r) => ({ ...r, seasonId: id! })) });
  });
  refresh(orgId);
  return { ok: true, id };
}

export async function deleteSeason(id: string): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  const res = await prisma.season.deleteMany({ where: { id, organizationId: u.organizationId } });
  if (res.count === 0) return { ok: false, error: t("notFound") };
  refresh(u.organizationId);
  return { ok: true };
}

/** Copy a season to next year (dates +1 year; a year in the name is bumped too). */
export async function duplicateSeasonNextYear(id: string): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  const s = await prisma.season.findFirst({ where: { id, organizationId: u.organizationId }, include: { rates: true } });
  if (!s) return { ok: false, error: t("notFound") };
  const plusYear = (d: Date) => { const n = new Date(d); n.setFullYear(n.getFullYear() + 1); return n; };
  const fromYear = s.startDate.getFullYear();
  const bump = (n: string) => (n.includes(String(fromYear)) ? n.replaceAll(String(fromYear), String(fromYear + 1)) : `${n} ${fromYear + 1}`);
  const copy = await prisma.$transaction(async (tx) => {
    const c = await tx.season.create({
      data: {
        organizationId: s.organizationId, name: bump(s.name), nameAr: s.nameAr ? bump(s.nameAr) : null,
        startDate: plusYear(s.startDate), endDate: plusYear(s.endDate), priority: s.priority, isActive: s.isActive,
        disallowMonthly: s.disallowMonthly, minNights: s.minNights, weekendAdjustPct: s.weekendAdjustPct, color: s.color,
        propertyIds: s.propertyIds, excludedUnitIds: s.excludedUnitIds,
      },
    });
    await tx.seasonRate.createMany({
      data: s.rates.map((r) => ({ seasonId: c.id, unitType: r.unitType, unitId: r.unitId, dailyRate: r.dailyRate, weeklyRate: r.weeklyRate, monthlyRate: r.monthlyRate })),
    });
    return c;
  });
  refresh(u.organizationId);
  return { ok: true, id: copy.id };
}

// ── Default rates (bulk editor) ──────────────────────────────────────────────

export type DefaultRateInput = { unitId: string; daily: string; weekly: string; monthly: string };

/** Upsert the DEFAULT price of many units at once (only rows the user changed). */
export async function saveDefaultRates(rows: DefaultRateInput[]): Promise<PricingResult & { saved?: number }> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  if (rows.length === 0) return { ok: true, saved: 0 };
  if (rows.length > 1000) return { ok: false, error: t("tooMany") };

  const owned = await prisma.unit.findMany({ where: { id: { in: rows.map((r) => r.unitId) }, property: { organizationId: u.organizationId } }, select: { id: true } });
  if (owned.length !== new Set(rows.map((r) => r.unitId)).size) return { ok: false, error: t("forbidden") };

  const parsed: { unitId: string; daily: Prisma.Decimal; weekly: Prisma.Decimal | null; monthly: Prisma.Decimal }[] = [];
  for (const r of rows) {
    const daily = money(r.daily), weekly = money(r.weekly), monthly = money(r.monthly);
    if (daily === undefined || weekly === undefined || monthly === undefined) return { ok: false, error: t("money") };
    if (daily === null || monthly === null) return { ok: false, error: t("dailyMonthlyRequired") };
    parsed.push({ unitId: r.unitId, daily, weekly, monthly });
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.unitPrice.findMany({ where: { unitId: { in: parsed.map((p) => p.unitId) }, priceType: "DEFAULT" }, select: { id: true, unitId: true } });
    const byUnit = new Map(existing.map((e) => [e.unitId, e.id]));
    for (const p of parsed) {
      const data = { dailyRate: p.daily, weeklyRate: p.weekly, monthlyRate: p.monthly, isActive: true };
      const id = byUnit.get(p.unitId);
      if (id) await tx.unitPrice.update({ where: { id }, data });
      else await tx.unitPrice.create({ data: { ...data, unitId: p.unitId, priceType: "DEFAULT" } });
    }
  }, { timeout: 60_000 });
  refresh(u.organizationId);
  return { ok: true, saved: parsed.length };
}

// ── Stay rules: weekend pricing ──────────────────────────────────────────────

/** Organization weekend rule: which nights (0 = Sun … 6 = Sat) and by how much (%). */
export async function saveWeekendRule(input: { days: number[]; pct: number }): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  const days = [...new Set(input.days)].sort();
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { ok: false, error: t("forbidden") };
  const pct = Math.round(input.pct);
  if (!Number.isFinite(pct) || pct < -90 || pct > 500) return { ok: false, error: t("weekendPct") };
  await prisma.organization.update({ where: { id: u.organizationId }, data: { weekendDays: days, weekendAdjustPct: pct } });
  refresh(u.organizationId);
  return { ok: true };
}

// ── Stay rules: minimum nights + long-stay discount ──────────────────────────

/** Organization default minimum stay for nightly bookings (1 = no minimum). */
export async function saveDefaultMinNights(nights: number): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  const n = Math.round(nights);
  if (!Number.isFinite(n) || n < 1 || n > 365) return { ok: false, error: t("minNights") };
  await prisma.organization.update({ where: { id: u.organizationId }, data: { defaultMinNights: n } });
  refresh(u.organizationId);
  return { ok: true };
}

/** Long-stay discount tiers for nightly stays (highest tier reached applies). */
export async function saveLongStayTiers(tiers: LongStayTier[]): Promise<PricingResult> {
  const t = await getTranslations("pricing.errors");
  const u = await editor();
  if (!u) return { ok: false, error: t("forbidden") };
  if (!Array.isArray(tiers) || tiers.length > MAX_TIERS) return { ok: false, error: t("tiers") };
  const clean = parseLongStayTiers(tiers);
  // every submitted row must survive validation, and nights must be unique
  if (clean.length !== tiers.length) return { ok: false, error: t("tiers") };
  await prisma.organization.update({ where: { id: u.organizationId }, data: { longStayDiscounts: clean } });
  refresh(u.organizationId);
  return { ok: true };
}
