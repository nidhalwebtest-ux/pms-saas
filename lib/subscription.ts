import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  resolveSubscription,
  limitFor,
  exceedsLimit,
  hasFeature,
  isFreePlan,
  PlanLimitError,
  type Feature,
  type LimitKind,
  type Subscription,
} from "@/lib/subscription-core";

/**
 * SaaS subscription engine — DB-backed helpers (Roadmap item 4).
 * Status rules and pure helpers: lib/subscription-core.ts.
 *
 * On expiry nothing is deleted or locked: existing buildings/units/users stay
 * usable; only CREATING beyond the effective plan's limits is blocked
 * (assertWithinLimit). Accounts already over a limit keep what they have.
 */

export * from "@/lib/subscription-core";

/** Plan as shown on pricing cards (landing + billing page). Money in integer baisa. */
export type PlanCardDTO = {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  monthly: number;
  semiannual: number;
  yearly: number;
  bulletsEn: string[];
  bulletsAr: string[];
  featured: boolean;
  free: boolean;
  maxBuildings: number | null;
  maxUnits: number | null;
};

/** Cache tag for the public plan list — savePlan / settings changes call updateTag on it. */
export const PLANS_TAG = "subscription-plans";

/**
 * Public, active plans + trial length for pricing cards. Cached across requests
 * (the landing page is hit on every visit; plans change rarely) and invalidated
 * instantly from super-admin via PLANS_TAG.
 */
export const getPublicPlans = unstable_cache(
  async (): Promise<{ plans: PlanCardDTO[]; trialDays: number; freePlanKey: string }> => {
    const [settings, rows] = await Promise.all([
      getPlatformSettings(),
      prisma.subscriptionPlan.findMany({ where: { isPublic: true, isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    return {
      trialDays: settings.trialDays,
      freePlanKey: settings.freePlanKey,
      plans: rows.map((p) => ({
        key: p.key, nameEn: p.nameEn, nameAr: p.nameAr, descriptionEn: p.descriptionEn, descriptionAr: p.descriptionAr,
        monthly: p.priceMonthlyBaisa, semiannual: p.priceSemiannualBaisa, yearly: p.priceYearlyBaisa,
        bulletsEn: p.bulletsEn, bulletsAr: p.bulletsAr, featured: p.isFeatured, free: isFreePlan(p),
        maxBuildings: p.maxBuildings, maxUnits: p.maxUnits,
      })),
    };
  },
  ["public-plans"],
  { revalidate: 300, tags: [PLANS_TAG] },
);

/** The platform settings singleton (read-or-create). */
export async function getPlatformSettings() {
  const existing = await prisma.platformSettings.findFirst({ orderBy: { createdAt: "asc" } });
  return existing ?? prisma.platformSettings.create({ data: {} });
}

/** The org's subscription, request-cached (≈2 queries per request). */
export const getSubscription = cache(async (organizationId: string): Promise<Subscription> => {
  const [org, settings] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { isDemo: true, trialEndsAt: true, paidUntil: true, billingCycle: true, subscriptionPlan: true },
    }),
    getPlatformSettings(),
  ]);
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { key: settings.freePlanKey } });
  return resolveSubscription(org, freePlan);
});

/**
 * Current usage the limits apply to. Archived buildings (and their units)
 * don't count. Users include pending, unexpired invitations, so inviting
 * can't overshoot the seat limit.
 */
export async function getUsage(organizationId: string): Promise<Record<LimitKind, number>> {
  const [buildings, units, users, invites] = await Promise.all([
    prisma.property.count({ where: { organizationId, isArchived: false } }),
    prisma.unit.count({ where: { property: { organizationId, isArchived: false } } }),
    prisma.user.count({ where: { organizationId } }),
    // pending = not used, not cancelled, not expired
    prisma.invitation.count({ where: { organizationId, usedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return { buildings, units, users: users + invites };
}

/**
 * Throws PlanLimitError if adding `adding` more of `kind` would exceed the
 * effective plan's limit. Call in every create path BEFORE writing; catch it
 * and return `{ success: false, error: e.code }`.
 */
export async function assertWithinLimit(organizationId: string, kind: LimitKind, adding = 1) {
  const sub = await getSubscription(organizationId);
  const limit = limitFor(sub, kind);
  if (limit === null) return;
  const used = (await getUsage(organizationId))[kind];
  if (exceedsLimit(limit, used, adding)) throw new PlanLimitError(kind, limit, used);
}

/** The effective plan's name in the current UI language. */
async function planDisplayName(sub: Subscription): Promise<string> {
  const p = sub.effectivePlan;
  if (!p) return "";
  return (await getLocale()) === "ar" ? p.nameAr : p.nameEn;
}

/**
 * Translated "your plan allows up to N …" message when adding `adding` more of
 * `kind` would exceed the plan, else null. The one call every create path makes:
 *   const limitMsg = await planLimitMessage(orgId, "units");
 *   if (limitMsg) return { error: limitMsg };
 */
export async function planLimitMessage(
  organizationId: string,
  kind: LimitKind,
  adding = 1,
  messageKey: LimitKind | "restoreBuilding" = kind,
): Promise<string | null> {
  try {
    await assertWithinLimit(organizationId, kind, adding);
    return null;
  } catch (e) {
    if (!(e instanceof PlanLimitError)) throw e;
    const t = await getTranslations("subscription.limit");
    return t(messageKey, { plan: await planDisplayName(await getSubscription(organizationId)), limit: e.limit });
  }
}

/** Translated "not included in your plan" message, or null when the feature is on. */
export async function featureBlockedMessage(organizationId: string, feature: Extract<Feature, "website" | "whatsapp">): Promise<string | null> {
  const sub = await getSubscription(organizationId);
  if (hasFeature(sub, feature)) return null;
  const t = await getTranslations("subscription.feature");
  return t(feature, { plan: await planDisplayName(sub) });
}

/** Thrown by shared create cores (also used by CSV import) — message is already translated. */
export class PlanLimitReached extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitReached";
  }
}

/**
 * Start the free trial for a brand-new organization (onboarding signup).
 * Uses PlatformSettings (trial length + plan). Logs a TRIAL_STARTED event.
 * Pass a transaction client to run inside the signup transaction.
 */
export async function startTrialForNewOrg(
  organizationId: string,
  db: Pick<typeof prisma, "organization" | "subscriptionEvent" | "subscriptionPlan"> = prisma,
) {
  const settings = await getPlatformSettings();
  const plan = await db.subscriptionPlan.findUnique({ where: { key: settings.trialPlanKey } });
  if (!plan) return; // catalogue not set up — org stays on Free
  const trialEndsAt = new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000);
  await db.organization.update({ where: { id: organizationId }, data: { planId: plan.id, trialEndsAt } });
  await db.subscriptionEvent.create({
    data: { organizationId, type: "TRIAL_STARTED", planId: plan.id, toPlanKey: plan.key, trialEndsAt, actor: "system", note: "Signup" },
  });
}
