// Run: npm run test:pricing
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMonthlyBaisa,
  quoteBilling,
  formatBaisa,
} from "./saas-pricing";

test("worked examples from the spec", () => {
  const cases: Array<[number, number]> = [
    [10, 10_000],
    [20, 20_000],
    [40, 34_000], // 20×1.0 + 20×0.7
    [50, 41_000], // 20×1.0 + 30×0.7
    [60, 46_000], // 20 + 21 + 10×0.5
    [100, 66_000], // 20 + 21 + 50×0.5
  ];
  for (const [units, expected] of cases) {
    assert.equal(calculateMonthlyBaisa(units), expected, `${units} units`);
  }
});

test("0 units costs nothing; 1 unit costs 1.000", () => {
  assert.equal(calculateMonthlyBaisa(0), 0);
  assert.equal(calculateMonthlyBaisa(1), 1_000);
});

test("total strictly increases with every added unit (1–500)", () => {
  let prev = calculateMonthlyBaisa(1);
  for (let u = 2; u <= 500; u++) {
    const cur = calculateMonthlyBaisa(u);
    assert.ok(cur > prev, `${u} units (${cur}) not more than ${u - 1} (${prev})`);
    prev = cur;
  }
});

test("band boundaries are marginal, not flat-rate", () => {
  assert.equal(calculateMonthlyBaisa(21) - calculateMonthlyBaisa(20), 700);
  assert.equal(calculateMonthlyBaisa(51) - calculateMonthlyBaisa(50), 500);
});

test("annual billing is 20% off 12 months", () => {
  const q = quoteBilling(40); // 34.000 × 12 = 408.000 → 326.400
  assert.equal(q.yearlyUndiscountedBaisa, 408_000);
  assert.equal(q.yearlyBaisa, 326_400);
  assert.equal(q.yearlySavingsBaisa, 81_600);
  assert.equal(quoteBilling(10).yearlyBaisa, 96_000); // 10 × 12 × 0.8
});

test("rejects invalid unit counts", () => {
  assert.throws(() => calculateMonthlyBaisa(-1));
  assert.throws(() => calculateMonthlyBaisa(2.5));
});

test("formatBaisa always uses 3 decimals", () => {
  assert.equal(formatBaisa(34_000), "34.000");
  assert.equal(formatBaisa(13_500), "13.500");
  assert.equal(formatBaisa(5), "0.005");
});
