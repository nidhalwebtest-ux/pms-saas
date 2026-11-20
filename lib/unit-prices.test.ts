// Run: npm run test:unit-prices
// Central seasons → per-unit SEASONAL rows, and how resolvePrice then prices nights.
import { test } from "node:test";
import assert from "node:assert/strict";
// (importing these constructs the Prisma client but never connects — tests are pure)
import { seasonRowsForUnit, type SeasonForMatch, type PriceRow } from "./unit-prices";
import { resolvePrice, applyWeekend, weekendRuleOf } from "./pricing";
import { parseLongStayTiers, longStayTierFor, longStayDiscount } from "./stay-rules";

const ORG = "org1";
const unit = (id: string, unitType = "ONE_BR", propertyId = "b1") => ({ id, unitType, propertyId, organizationId: ORG });
const DEF: PriceRow = {
  id: "def", priceType: "DEFAULT", name: null, dailyRate: "20.000", weeklyRate: null, monthlyRate: "400.000",
  startDate: null, endDate: null, priority: 10, isActive: true, disallowMonthly: false,
};
const season = (o: Partial<SeasonForMatch> = {}): SeasonForMatch => ({
  id: "s1", organizationId: ORG, name: "Khareef", startDate: new Date("2026-07-01T00:00:00.000Z"), endDate: new Date("2026-08-31T23:59:59.999Z"),
  priority: 20, isActive: true, disallowMonthly: false, propertyIds: [], excludedUnitIds: [],
  rates: [{ unitId: null, unitType: "ONE_BR", dailyRate: "48.000", weeklyRate: null, monthlyRate: null }], ...o,
});
const priceOn = (rows: PriceRow[], ymd: string) => resolvePrice(rows, new Date(`${ymd}T00:00:00.000Z`), null);

test("type rate applies to every unit of that type", () => {
  const rows = seasonRowsForUnit(unit("u1"), [DEF], [season()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "season:s1");
  assert.equal(String(rows[0].dailyRate), "48.000");
  assert.equal(String(rows[0].monthlyRate), "400.000", "monthly falls back to the unit's default");
});

test("other unit types are not affected", () => {
  assert.equal(seasonRowsForUnit(unit("u2", "STUDIO"), [DEF], [season()]).length, 0);
});

test("per-unit override beats the type rate", () => {
  const s = season({ rates: [...season().rates, { unitId: "u1", unitType: null, dailyRate: "55.500", weeklyRate: null, monthlyRate: null }] });
  assert.equal(String(seasonRowsForUnit(unit("u1"), [DEF], [s])[0].dailyRate), "55.500");
  assert.equal(String(seasonRowsForUnit(unit("u3"), [DEF], [s])[0].dailyRate), "48.000");
});

test("an override puts a unit of an unpriced type into the season", () => {
  const s = season({ rates: [{ unitId: "u9", unitType: null, dailyRate: "99.000", weeklyRate: null, monthlyRate: null }] });
  assert.equal(seasonRowsForUnit(unit("u9", "SUITE"), [DEF], [s]).length, 1);
  assert.equal(seasonRowsForUnit(unit("u8", "SUITE"), [DEF], [s]).length, 0);
});

test("excluded units and other buildings keep their default", () => {
  assert.equal(seasonRowsForUnit(unit("u1"), [DEF], [season({ excludedUnitIds: ["u1"] })]).length, 0);
  assert.equal(seasonRowsForUnit(unit("u1", "ONE_BR", "b2"), [DEF], [season({ propertyIds: ["b1"] })]).length, 0);
  assert.equal(seasonRowsForUnit(unit("u1", "ONE_BR", "b1"), [DEF], [season({ propertyIds: ["b1"] })]).length, 1);
});

test("another organization's season never applies", () => {
  assert.equal(seasonRowsForUnit(unit("u1"), [DEF], [season({ organizationId: "org2" })]).length, 0);
});

test("resolved nightly price: season inside its dates (inclusive), default outside", () => {
  const rows = [DEF, ...seasonRowsForUnit(unit("u1"), [DEF], [season()])];
  assert.equal(priceOn(rows, "2026-06-30")?.dailyRate, 20);
  assert.equal(priceOn(rows, "2026-07-01")?.dailyRate, 48);
  assert.equal(priceOn(rows, "2026-08-31")?.dailyRate, 48);
  assert.equal(priceOn(rows, "2026-09-01")?.dailyRate, 20);
});

test("overlapping seasons: higher priority wins; inactive seasons are ignored", () => {
  const peak = season({ id: "s2", name: "Eid", priority: 30, startDate: new Date("2026-07-10T00:00:00.000Z"), endDate: new Date("2026-07-12T23:59:59.999Z"), rates: [{ unitId: null, unitType: "ONE_BR", dailyRate: "70.000", weeklyRate: null, monthlyRate: null }] });
  const rows = [DEF, ...seasonRowsForUnit(unit("u1"), [DEF], [season(), peak])];
  assert.equal(priceOn(rows, "2026-07-11")?.dailyRate, 70);
  assert.equal(priceOn(rows, "2026-07-13")?.dailyRate, 48);
  const rowsOff = [DEF, ...seasonRowsForUnit(unit("u1"), [DEF], [season({ isActive: false })])];
  assert.equal(priceOn(rowsOff, "2026-07-15")?.dailyRate, 20);
});

// ── Weekend pricing (Stay rules) ─────────────────────────────────────────────
// 2026-07-02 is a Thursday, 2026-07-03 a Friday, 2026-06-29 a Monday.
const THU_FRI = { days: [4, 5], pct: 20 };
const nightRate = (rows: PriceRow[], ymd: string, rule = THU_FRI) => {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return applyWeekend(resolvePrice(rows, d, null), d, rule);
};

test("weekend %: only on the chosen nights, labelled, rounded to baisa", () => {
  assert.deepEqual(nightRate([DEF], "2026-06-29"), { rate: 20, weekend: false, name: null });
  assert.deepEqual(nightRate([DEF], "2026-07-02"), { rate: 24, weekend: true, name: "Weekend" });
  const odd: PriceRow = { ...DEF, dailyRate: "17.333" };
  assert.equal(nightRate([odd], "2026-07-03", { days: [5], pct: 15 }).rate, 19.933); // 17333 × 1.15 = 19932.95 → 19933
});

test("weekend %: a season's own % (even 0) beats the organization's", () => {
  const withSeason = (pct: number | null) => [DEF, ...seasonRowsForUnit(unit("u1"), [DEF], [season({ weekendAdjustPct: pct })])];
  assert.deepEqual(nightRate(withSeason(null), "2026-07-02"), { rate: 57.6, weekend: true, name: "Khareef · Weekend" });
  assert.equal(nightRate(withSeason(50), "2026-07-02").rate, 72);
  assert.deepEqual(nightRate(withSeason(0), "2026-07-02"), { rate: 48, weekend: false, name: "Khareef" });
});

test("weekend %: discounts work and no rule means no change", () => {
  assert.equal(nightRate([DEF], "2026-07-02", { days: [4], pct: -10 }).rate, 18);
  assert.equal(applyWeekend(resolvePrice([DEF], new Date("2026-07-02T00:00:00.000Z"), null), new Date("2026-07-02T00:00:00.000Z"), null).rate, 20);
  assert.equal(weekendRuleOf({ weekendDays: [], weekendAdjustPct: 20 }), null);
  assert.deepEqual(weekendRuleOf({ weekendDays: [4, 5], weekendAdjustPct: 20 }), THU_FRI);
});

// ── Minimum nights + long-stay discount (Stay rules) ─────────────────────────

test("season minimum nights travels on its price rows", () => {
  const rows = [DEF, ...seasonRowsForUnit(unit("u1"), [DEF], [season({ minNights: 3 })])];
  assert.equal(priceOn(rows, "2026-07-05")?.minNights, 3);
  assert.equal(priceOn(rows, "2026-06-30")?.minNights, null, "default nights → organization default");
});

test("long-stay tiers: sanitised, highest reached tier wins", () => {
  const tiers = parseLongStayTiers([{ minNights: 28, percent: 15 }, { minNights: 7, percent: 5 }, { minNights: 1, percent: 50 }, { minNights: 14, percent: 0 }, "junk"]);
  assert.deepEqual(tiers, [{ minNights: 7, percent: 5 }, { minNights: 28, percent: 15 }]);
  assert.equal(longStayTierFor(6, tiers), null);
  assert.deepEqual(longStayTierFor(7, tiers), { minNights: 7, percent: 5 });
  assert.deepEqual(longStayTierFor(30, tiers), { minNights: 28, percent: 15 });
  assert.deepEqual(parseLongStayTiers(null), []);
});

test("long-stay discount: % of subtotal in whole baisa, nightly stays only", () => {
  const tiers = [{ minNights: 7, percent: 5 }];
  assert.deepEqual(longStayDiscount(350, 7, tiers), { amount: 17.5, tier: tiers[0] });
  assert.equal(longStayDiscount(123.457, 7, tiers).amount, 6.173); // 123457 × 5% = 6172.85 → 6173
  assert.equal(longStayDiscount(350, 6, tiers).amount, 0);
  assert.equal(longStayDiscount(800, 30, tiers, "monthly").amount, 0);
});
