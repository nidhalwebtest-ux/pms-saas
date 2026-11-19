// Run: npm run test:subscription
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SubscriptionPlan } from "@prisma/client";
import { resolveSubscription, limitFor, hasFeature, exceedsLimit, isFreePlan, PlanLimitError, formatOmr, formatOmrShort, pricePerMonth } from "./subscription-core";
import { DEFAULT_PLANS } from "./subscription-plans";

const NOW = new Date("2026-11-20T10:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const plan = (key: string): SubscriptionPlan => {
  const seed = DEFAULT_PLANS.find((p) => p.key === key)!;
  return { id: key, isActive: true, createdAt: NOW, updatedAt: NOW, ...seed } as SubscriptionPlan;
};
const FREE = plan("free"), STARTER = plan("starter"), GROWTH = plan("growth"), ULTIMATE = plan("ultimate");
const org = (o: Partial<Parameters<typeof resolveSubscription>[0]>) => ({
  isDemo: false, trialEndsAt: null, paidUntil: null, billingCycle: "MONTHLY", subscriptionPlan: null, ...o,
});

test("catalogue: only Free is free; prices are integer baisa", () => {
  assert.equal(isFreePlan(FREE), true);
  for (const p of [STARTER, GROWTH, ULTIMATE]) assert.equal(isFreePlan(p), false);
  for (const p of DEFAULT_PLANS) {
    for (const v of [p.priceMonthlyBaisa, p.priceSemiannualBaisa, p.priceYearlyBaisa]) assert.ok(Number.isInteger(v));
  }
  assert.equal(STARTER.priceSemiannualBaisa, 13_500); // 15 OMR − 10%
});

test("trial in progress → TRIALING on the trial plan, days left rounded up", () => {
  const s = resolveSubscription(org({ subscriptionPlan: GROWTH, trialEndsAt: days(29.2) }), FREE, NOW);
  assert.equal(s.status, "TRIALING");
  assert.equal(s.effectivePlan?.key, "growth");
  assert.equal(s.daysLeft, 30);
});

test("trial ended, never paid → EXPIRED, Free limits apply", () => {
  const s = resolveSubscription(org({ subscriptionPlan: GROWTH, trialEndsAt: days(-1) }), FREE, NOW);
  assert.equal(s.status, "EXPIRED");
  assert.equal(s.plan?.key, "growth");
  assert.equal(s.effectivePlan?.key, "free");
  assert.equal(limitFor(s, "units"), 5);
  assert.equal(hasFeature(s, "website"), false);
});

test("paid plan with paidUntil in the future → ACTIVE", () => {
  const s = resolveSubscription(org({ subscriptionPlan: STARTER, trialEndsAt: days(-40), paidUntil: days(10) }), FREE, NOW);
  assert.equal(s.status, "ACTIVE");
  assert.equal(s.effectivePlan?.key, "starter");
  assert.equal(s.daysLeft, 10);
  assert.equal(limitFor(s, "units"), 20);
});

test("paid period lapsed → EXPIRED back to Free", () => {
  const s = resolveSubscription(org({ subscriptionPlan: STARTER, paidUntil: days(-0.01) }), FREE, NOW);
  assert.equal(s.status, "EXPIRED");
  assert.equal(s.effectivePlan?.key, "free");
});

test("no plan assigned → Free, ACTIVE", () => {
  const s = resolveSubscription(org({}), FREE, NOW);
  assert.equal(s.status, "ACTIVE");
  assert.equal(s.effectivePlan?.key, "free");
});

test("comped custom plan (price 0, generous limits) stays ACTIVE without paidUntil", () => {
  const comped = { ...ULTIMATE, key: "founder-deal", priceMonthlyBaisa: 0, priceSemiannualBaisa: 0, priceYearlyBaisa: 0 };
  const s = resolveSubscription(org({ subscriptionPlan: comped }), FREE, NOW);
  assert.equal(s.status, "ACTIVE");
  assert.equal(limitFor(s, "buildings"), null);
});

test("demo orgs are unlimited with every feature", () => {
  const s = resolveSubscription(org({ isDemo: true, subscriptionPlan: FREE }), FREE, NOW);
  assert.equal(s.status, "DEMO");
  assert.equal(limitFor(s, "units"), null);
  assert.equal(hasFeature(s, "whatsapp"), true);
});

test("feature gates follow the plan", () => {
  const active = (p: SubscriptionPlan) => resolveSubscription(org({ subscriptionPlan: p, paidUntil: days(5) }), FREE, NOW);
  assert.equal(hasFeature(active(STARTER), "website"), false);
  assert.equal(hasFeature(active(GROWTH), "website"), true);
  assert.equal(hasFeature(active(GROWTH), "whatsapp"), false);
  assert.equal(hasFeature(active(ULTIMATE), "whatsapp"), true);
});

test("exceedsLimit: at the limit is fine, one over is not; null never exceeds", () => {
  assert.equal(exceedsLimit(5, 4, 1), false);
  assert.equal(exceedsLimit(5, 5, 1), true);
  assert.equal(exceedsLimit(5, 26, 0), true); // already over (grandfathered data) — but adding 0 is the caller's no-op
  assert.equal(exceedsLimit(null, 10_000, 500), false);
});

test("formatOmr / formatOmrShort use integer math", () => {
  assert.equal(formatOmr(13_500), "13.500");
  assert.equal(formatOmr(5), "0.005");
  assert.equal(formatOmr(0), "0.000");
  assert.equal(formatOmrShort(15_000), "15");
  assert.equal(formatOmrShort(13_500), "13.5");
  assert.equal(formatOmrShort(0), "0");
  assert.equal(pricePerMonth(STARTER, "YEARLY"), 10_000);
  assert.equal(pricePerMonth(STARTER, "SEMIANNUAL"), 13_500);
  assert.equal(pricePerMonth(STARTER, "MONTHLY"), 15_000);
});

test("PlanLimitError carries a stable code", () => {
  const e = new PlanLimitError("units", 5, 5);
  assert.equal(e.code, "plan_limit_units");
  assert.ok(e instanceof Error);
});
