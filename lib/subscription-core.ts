import type { SubscriptionPlan } from "@prisma/client";

/**
 * Pure subscription logic (no DB, no server-only) — unit-tested in
 * lib/subscription.test.ts. DB-backed helpers live in lib/subscription.ts.
 *
 * The effective status is CALCULATED from dates on every read — never stored,
 * so nothing has to run on a schedule to expire a trial:
 *   DEMO      demo sandbox org                          → unlimited
 *   TRIALING  trialEndsAt > now                         → the org's plan
 *   ACTIVE    plan priced 0 (Free, or a comped custom)  → the org's plan
 *   ACTIVE    paid plan and paidUntil > now             → the org's plan
 *   EXPIRED   otherwise                                 → the Free plan's limits
 */

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "EXPIRED" | "DEMO";
export type LimitKind = "buildings" | "units" | "users";
export type Feature = "website" | "whatsapp" | "onlinePayments" | "aiAssistant";

export type Subscription = {
  status: SubscriptionStatus;
  /** The plan the org is on (what admin assigned / what they trial). */
  plan: SubscriptionPlan | null;
  /** The plan whose limits & features apply right now (Free when expired; null = unlimited demo). */
  effectivePlan: SubscriptionPlan | null;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  billingCycle: string;
  /** Whole days left in the trial / paid period (null when not applicable). */
  daysLeft: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

type Prices = Pick<SubscriptionPlan, "priceMonthlyBaisa" | "priceSemiannualBaisa" | "priceYearlyBaisa">;
export const isFreePlan = (p: Prices) =>
  p.priceMonthlyBaisa === 0 && p.priceSemiannualBaisa === 0 && p.priceYearlyBaisa === 0;

export type OrgSubscriptionFields = {
  isDemo: boolean;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  billingCycle: string;
  subscriptionPlan: SubscriptionPlan | null;
};

export function resolveSubscription(
  org: OrgSubscriptionFields,
  freePlan: SubscriptionPlan | null,
  now: Date = new Date(),
): Subscription {
  const plan = org.subscriptionPlan ?? freePlan;
  const base = { plan, trialEndsAt: org.trialEndsAt, paidUntil: org.paidUntil, billingCycle: org.billingCycle };
  const daysUntil = (d: Date) => Math.max(0, Math.ceil((d.getTime() - now.getTime()) / DAY_MS));

  if (org.isDemo) return { ...base, status: "DEMO", effectivePlan: null, daysLeft: null };
  if (org.trialEndsAt && org.trialEndsAt > now) {
    return { ...base, status: "TRIALING", effectivePlan: plan, daysLeft: daysUntil(org.trialEndsAt) };
  }
  if (plan && isFreePlan(plan)) return { ...base, status: "ACTIVE", effectivePlan: plan, daysLeft: null };
  if (plan && org.paidUntil && org.paidUntil > now) {
    return { ...base, status: "ACTIVE", effectivePlan: plan, daysLeft: daysUntil(org.paidUntil) };
  }
  return { ...base, status: "EXPIRED", effectivePlan: freePlan, daysLeft: null };
}

/** null = unlimited (demo org, or the plan has no limit for this kind). */
export function limitFor(sub: Subscription, kind: LimitKind): number | null {
  const p = sub.effectivePlan;
  if (!p) return null;
  return kind === "buildings" ? p.maxBuildings : kind === "units" ? p.maxUnits : p.maxUsers;
}

export function hasFeature(sub: Subscription, feature: Feature): boolean {
  const p = sub.effectivePlan;
  if (!p) return true; // demo: everything on
  switch (feature) {
    case "website": return p.featureWebsite;
    case "whatsapp": return p.featureWhatsapp;
    case "onlinePayments": return p.featureOnlinePayments;
    case "aiAssistant": return p.featureAiAssistant;
  }
}

/** Integer baisa → "15.000" (always 3 decimals, no floating point). */
export function formatOmr(baisa: number): string {
  const n = Math.round(baisa);
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  return `${sign}${Math.floor(a / 1000)}.${String(a % 1000).padStart(3, "0")}`;
}

/** Integer baisa → "15" or "13.5" (marketing display: trailing zeros dropped). */
export function formatOmrShort(baisa: number): string {
  return formatOmr(baisa).replace(/\.?0+$/, "");
}

/** Price per month for a billing cycle. */
export function pricePerMonth(p: Prices, cycle: string): number {
  return cycle === "YEARLY" ? p.priceYearlyBaisa : cycle === "SEMIANNUAL" ? p.priceSemiannualBaisa : p.priceMonthlyBaisa;
}

/** Would adding `adding` more exceed the limit? (null limit = never.) */
export function exceedsLimit(limit: number | null, used: number, adding: number): boolean {
  return limit !== null && used + adding > limit;
}

export class PlanLimitError extends Error {
  constructor(
    public kind: LimitKind,
    public limit: number,
    public used: number,
  ) {
    super(`plan_limit_${kind}`);
    this.name = "PlanLimitError";
  }
  /** Machine-readable code for action/API responses; the UI maps it to i18n. */
  get code() {
    return `plan_limit_${this.kind}`;
  }
}
