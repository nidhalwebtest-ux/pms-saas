// Run: npm run test:unit-prices
// Central seasons → per-unit SEASONAL rows, and how resolvePrice then prices nights.
import { test } from "node:test";
import assert from "node:assert/strict";
// (importing these constructs the Prisma client but never connects — tests are pure)
import { seasonRowsForUnit, type SeasonForMatch, type PriceRow } from "./unit-prices";
import { resolvePrice } from "./pricing";

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
