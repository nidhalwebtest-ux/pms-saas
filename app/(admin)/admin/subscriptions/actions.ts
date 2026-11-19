"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { getPlatformSettings, PLANS_TAG } from "@/lib/subscription";

/**
 * Super-admin subscription management (Roadmap item 4, phase C).
 * Every action: super-admin only; every org-level change appends a
 * SubscriptionEvent (actor = admin email) so the history is complete.
 * Money arrives as text ("45.500") and is parsed to integer baisa — no floats.
 */

export type AdminResult = { ok: true } | { ok: false; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLES = ["MONTHLY", "SEMIANNUAL", "YEARLY"] as const;
type Cycle = (typeof CYCLES)[number];

/** "45", "45.5", "45.500" → 45500 baisa. null when invalid / negative / >3 decimals.
 *  (Not exported: every export of a "use server" file becomes a callable action.) */
function parseOmrToBaisa(raw: string): number | null {
  const s = raw.trim();
  const m = /^(\d{1,7})(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
}

async function admin() {
  return getSuperAdmin();
}

function refresh(orgId?: string) {
  updateTag(PLANS_TAG); // landing + billing pricing cards
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/organizations");
  if (orgId) revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/dashboard", "layout"); // trial banner / billing page
}

// ── Platform settings ────────────────────────────────────────────────────────

export async function updatePlatformSettings(input: { trialDays: number; trialPlanKey: string; freePlanKey: string }): Promise<AdminResult> {
  if (!(await admin())) return { ok: false, error: "Not authorized" };
  const trialDays = Math.round(input.trialDays);
  if (!Number.isFinite(trialDays) || trialDays < 0 || trialDays > 365) return { ok: false, error: "Trial days must be between 0 and 365" };
  const keys = await prisma.subscriptionPlan.findMany({ where: { key: { in: [input.trialPlanKey, input.freePlanKey] } }, select: { key: true, priceMonthlyBaisa: true, priceSemiannualBaisa: true, priceYearlyBaisa: true } });
  if (!keys.some((k) => k.key === input.trialPlanKey)) return { ok: false, error: "Unknown trial plan" };
  const free = keys.find((k) => k.key === input.freePlanKey);
  if (!free) return { ok: false, error: "Unknown fallback plan" };
  if (free.priceMonthlyBaisa || free.priceSemiannualBaisa || free.priceYearlyBaisa) {
    return { ok: false, error: "The fallback plan must be free (price 0)" };
  }
  const s = await getPlatformSettings();
  await prisma.platformSettings.update({ where: { id: s.id }, data: { trialDays, trialPlanKey: input.trialPlanKey, freePlanKey: input.freePlanKey } });
  refresh();
  return { ok: true };
}

// ── Plans ────────────────────────────────────────────────────────────────────

export type PlanInput = {
  id?: string;
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceMonthly: string;    // OMR text
  priceSemiannual: string;
  priceYearly: string;
  maxBuildings: number | null;
  maxUnits: number | null;
  maxUsers: number | null;
  featureWebsite: boolean;
  featureWhatsapp: boolean;
  featureOnlinePayments: boolean;
  featureAiAssistant: boolean;
  bulletsEn: string;       // one per line
  bulletsAr: string;
  isPublic: boolean;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
};

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const limit = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.max(0, Math.round(v)));

export async function savePlan(input: PlanInput): Promise<AdminResult & { id?: string }> {
  if (!(await admin())) return { ok: false, error: "Not authorized" };
  const key = input.key.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(key)) return { ok: false, error: "Key: 2–40 lowercase letters, digits or dashes" };
  if (!input.nameEn.trim() || !input.nameAr.trim()) return { ok: false, error: "English and Arabic names are required" };

  const [m, s, y] = [parseOmrToBaisa(input.priceMonthly), parseOmrToBaisa(input.priceSemiannual), parseOmrToBaisa(input.priceYearly)];
  if (m === null || s === null || y === null) return { ok: false, error: "Prices must be amounts like 15 or 13.500 (max 3 decimals)" };

  const clash = await prisma.subscriptionPlan.findUnique({ where: { key }, select: { id: true } });
  if (clash && clash.id !== input.id) return { ok: false, error: `Key "${key}" is already used` };

  if (input.id) {
    // The fallback plan must stay free.
    const settings = await getPlatformSettings();
    const current = await prisma.subscriptionPlan.findUnique({ where: { id: input.id }, select: { key: true } });
    if (current?.key === settings.freePlanKey && (m || s || y)) return { ok: false, error: "This is the fallback (Free) plan — it must stay at price 0" };
    if (current && current.key !== key && (current.key === settings.freePlanKey || current.key === settings.trialPlanKey)) {
      return { ok: false, error: "Can't rename the key of the trial or fallback plan (change it in settings first)" };
    }
  }

  const data = {
    key,
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    descriptionEn: input.descriptionEn.trim() || null,
    descriptionAr: input.descriptionAr.trim() || null,
    priceMonthlyBaisa: m,
    priceSemiannualBaisa: s,
    priceYearlyBaisa: y,
    maxBuildings: limit(input.maxBuildings),
    maxUnits: limit(input.maxUnits),
    maxUsers: limit(input.maxUsers),
    featureWebsite: input.featureWebsite,
    featureWhatsapp: input.featureWhatsapp,
    featureOnlinePayments: input.featureOnlinePayments,
    featureAiAssistant: input.featureAiAssistant,
    bulletsEn: lines(input.bulletsEn),
    bulletsAr: lines(input.bulletsAr),
    isPublic: input.isPublic,
    isFeatured: input.isFeatured,
    isActive: input.isActive,
    sortOrder: Math.round(input.sortOrder) || 0,
  };
  const saved = input.id
    ? await prisma.subscriptionPlan.update({ where: { id: input.id }, data, select: { id: true } })
    : await prisma.subscriptionPlan.create({ data, select: { id: true } });
  refresh();
  revalidatePath("/"); // landing pricing
  return { ok: true, id: saved.id };
}

// ── Organization subscription ────────────────────────────────────────────────

async function orgWithPlan(orgId: string) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, trialEndsAt: true, paidUntil: true, billingCycle: true, subscriptionPlan: { select: { id: true, key: true } } },
  });
}

/** Assign a plan. `keepTrial`: leave trialEndsAt as is (else the trial ends now). */
export async function changeOrgPlan(orgId: string, planId: string, keepTrial: boolean, note: string): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  const [org, plan] = await Promise.all([orgWithPlan(orgId), prisma.subscriptionPlan.findUnique({ where: { id: planId } })]);
  if (!org || !plan) return { ok: false, error: "Not found" };
  if (!plan.isActive && plan.id !== org.subscriptionPlan?.id) return { ok: false, error: "That plan is inactive — activate it first" };
  const now = new Date();
  const trialEndsAt = keepTrial ? org.trialEndsAt : org.trialEndsAt && org.trialEndsAt > now ? now : org.trialEndsAt;
  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { planId: plan.id, trialEndsAt } }),
    prisma.subscriptionEvent.create({
      data: {
        organizationId: orgId, type: "PLAN_CHANGED", planId: plan.id, fromPlanKey: org.subscriptionPlan?.key ?? null,
        toPlanKey: plan.key, trialEndsAt, paidUntil: org.paidUntil, actor: a.email, note: note.trim() || null,
      },
    }),
  ]);
  refresh(orgId);
  return { ok: true };
}

/** Extend (or start) the trial by N days from max(now, current trial end). */
export async function extendOrgTrial(orgId: string, days: number, note: string): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  const n = Math.round(days);
  if (!Number.isFinite(n) || n < 1 || n > 365) return { ok: false, error: "Days must be between 1 and 365" };
  const org = await orgWithPlan(orgId);
  if (!org) return { ok: false, error: "Not found" };
  const from = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
  const trialEndsAt = new Date(from.getTime() + n * DAY_MS);
  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { trialEndsAt } }),
    prisma.subscriptionEvent.create({
      data: {
        organizationId: orgId, type: "TRIAL_EXTENDED", planId: org.subscriptionPlan?.id ?? null, toPlanKey: org.subscriptionPlan?.key ?? null,
        trialEndsAt, actor: a.email, note: note.trim() || `+${n} days`,
      },
    }),
  ]);
  refresh(orgId);
  return { ok: true };
}

/** End the trial now (status recalculates: paid → ACTIVE, else → Free). */
export async function endOrgTrial(orgId: string, note: string): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  const org = await orgWithPlan(orgId);
  if (!org) return { ok: false, error: "Not found" };
  const now = new Date();
  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { trialEndsAt: now } }),
    prisma.subscriptionEvent.create({
      data: { organizationId: orgId, type: "TRIAL_EXTENDED", planId: org.subscriptionPlan?.id ?? null, trialEndsAt: now, actor: a.email, note: note.trim() || "Trial ended by admin" },
    }),
  ]);
  refresh(orgId);
  return { ok: true };
}

/**
 * Record a manual payment (bank transfer / cash) for `months` of service on the
 * org's current plan. paidUntil = max(now, paidUntil) + months. Ends a running
 * trial (they're paying now).
 */
export async function recordOrgPayment(orgId: string, input: { amount: string; months: number; cycle: string; note: string }): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  const amountBaisa = parseOmrToBaisa(input.amount);
  if (amountBaisa === null) return { ok: false, error: "Amount must be like 30 or 162.000 (max 3 decimals)" };
  const months = Math.round(input.months);
  if (!Number.isFinite(months) || months < 1 || months > 36) return { ok: false, error: "Months must be between 1 and 36" };
  const cycle = (CYCLES as readonly string[]).includes(input.cycle) ? (input.cycle as Cycle) : null;
  if (!cycle) return { ok: false, error: "Unknown billing cycle" };
  const org = await orgWithPlan(orgId);
  if (!org) return { ok: false, error: "Not found" };
  if (!org.subscriptionPlan) return { ok: false, error: "Assign a plan first" };

  const now = new Date();
  const start = org.paidUntil && org.paidUntil > now ? new Date(org.paidUntil) : now;
  const paidUntil = new Date(start);
  paidUntil.setMonth(paidUntil.getMonth() + months);
  const trialEndsAt = org.trialEndsAt && org.trialEndsAt > now ? now : org.trialEndsAt;

  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { paidUntil, billingCycle: cycle, trialEndsAt } }),
    prisma.subscriptionEvent.create({
      data: {
        organizationId: orgId, type: "PAYMENT_RECORDED", planId: org.subscriptionPlan.id, toPlanKey: org.subscriptionPlan.key,
        amountBaisa, billingCycle: cycle, paidUntil, actor: a.email, note: input.note.trim() || `${months} month(s)`,
      },
    }),
  ]);
  refresh(orgId);
  return { ok: true };
}

/** Set paid-until directly (corrections, comped periods). Empty = clear. */
export async function setOrgPaidUntil(orgId: string, dateIso: string, note: string): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  const org = await orgWithPlan(orgId);
  if (!org) return { ok: false, error: "Not found" };
  let paidUntil: Date | null = null;
  if (dateIso.trim()) {
    // date input → end of that day in Oman time (UTC+4) so "paid until 31 Dec" covers the 31st
    const d = new Date(`${dateIso.trim()}T23:59:59+04:00`);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
    paidUntil = d;
  }
  await prisma.$transaction([
    prisma.organization.update({ where: { id: orgId }, data: { paidUntil } }),
    prisma.subscriptionEvent.create({
      data: { organizationId: orgId, type: "PAID_UNTIL_SET", planId: org.subscriptionPlan?.id ?? null, paidUntil, actor: a.email, note: note.trim() || null },
    }),
  ]);
  refresh(orgId);
  return { ok: true };
}

export async function addOrgSubscriptionNote(orgId: string, note: string): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, error: "Not authorized" };
  if (!note.trim()) return { ok: false, error: "Note is empty" };
  await prisma.subscriptionEvent.create({ data: { organizationId: orgId, type: "NOTE", actor: a.email, note: note.trim() } });
  refresh(orgId);
  return { ok: true };
}
