/**
 * One-time (idempotent) setup for SaaS subscriptions — Roadmap item 4.
 *
 *  1. Creates the plan catalogue (lib/subscription-plans.ts) — only plans that
 *     don't exist yet; never overwrites plans already edited in admin.
 *  2. Creates the PlatformSettings singleton (30-day trial on "ultimate",
 *     fallback "free") if missing.
 *  3. Launch backfill: every NON-demo organization that has no subscription yet
 *     (planId null AND trialEndsAt null) starts a fresh trial from today, and a
 *     TRIAL_STARTED event is logged (actor "system"). Re-running skips orgs
 *     that already have one.
 *
 * Dry run (default — reports, writes nothing):
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/subscriptions-setup.ts
 * Execute:
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/subscriptions-setup.ts --confirm
 */
import { prisma } from "../lib/prisma";
import { DEFAULT_PLANS } from "../lib/subscription-plans";

const CONFIRM = process.argv.includes("--confirm");
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  console.log(CONFIRM ? "EXECUTING\n" : "DRY RUN (pass --confirm to write)\n");

  // 1. plans
  const existing = new Set((await prisma.subscriptionPlan.findMany({ select: { key: true } })).map((p) => p.key));
  const missing = DEFAULT_PLANS.filter((p) => !existing.has(p.key));
  console.log(`Plans: ${existing.size} exist, ${missing.length} to create (${missing.map((p) => p.key).join(", ") || "none"})`);
  if (CONFIRM && missing.length) await prisma.subscriptionPlan.createMany({ data: missing });

  // 2. settings
  let settings = await prisma.platformSettings.findFirst({ orderBy: { createdAt: "asc" } });
  console.log(`PlatformSettings: ${settings ? `exists (trial ${settings.trialDays}d on "${settings.trialPlanKey}")` : "to create (trial 30d on \"ultimate\")"}`);
  if (CONFIRM && !settings) settings = await prisma.platformSettings.create({ data: {} });
  const trialDays = settings?.trialDays ?? 30;
  const trialPlanKey = settings?.trialPlanKey ?? "ultimate";

  // 3. backfill
  const orgs = await prisma.organization.findMany({
    where: { isDemo: false, planId: null, trialEndsAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const trialEndsAt = new Date(Date.now() + trialDays * DAY_MS);
  console.log(`\nOrganizations to start a ${trialDays}-day "${trialPlanKey}" trial (ends ${trialEndsAt.toISOString().slice(0, 10)}): ${orgs.length}`);
  for (const o of orgs) console.log(`  - ${o.name}`);

  if (!CONFIRM) return;
  const trialPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { key: trialPlanKey } });
  for (const o of orgs) {
    await prisma.$transaction([
      prisma.organization.update({ where: { id: o.id }, data: { planId: trialPlan.id, trialEndsAt } }),
      prisma.subscriptionEvent.create({
        data: {
          organizationId: o.id, type: "TRIAL_STARTED", planId: trialPlan.id, toPlanKey: trialPlan.key,
          trialEndsAt, actor: "system", note: "Launch of subscriptions — fresh trial for existing customers",
        },
      }),
    ]);
  }
  console.log(`\nDone: ${missing.length} plans created, ${orgs.length} trials started.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
