#!/usr/bin/env tsx
/**
 * One-off benchmark for scripts/_seed/demo-data.ts — creates a throwaway
 * demo org (same shape app/demo/actions.ts produces), seeds it, times it,
 * and leaves the org in place for manual inspection (delete it via the
 * admin panel or a follow-up cleanup script once done).
 *
 * Run with:
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/bench-demo-seed.ts
 */
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { seedDemoOrg } from "./_seed/demo-data";

async function main() {
  const admin = createAdminClient();
  const demoEmail = `demo-bench-${crypto.randomUUID()}@internal.binaya.app`;
  const demoPassword = crypto.randomUUID();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
  });
  if (authError || !authData.user) throw authError ?? new Error("auth create failed");

  const org = await prisma.organization.create({
    data: {
      name: "Bench Visitor — Demo",
      currency: "OMR",
      city: "Salalah",
      plan: "FREE",
      isDemo: true,
      demoCreatedAt: new Date(),
      demoContactName: "Bench Visitor",
      demoContactWhatsapp: `+968${Math.floor(90000000 + Math.random() * 9000000)}`,
      users: {
        create: {
          id: authData.user.id,
          email: demoEmail,
          firstName: "Bench Visitor",
          role: "OWNER",
          preferredLanguage: "ar",
        },
      },
    },
  });

  console.log(`Org created: ${org.id}. Seeding...`);
  const result = await seedDemoOrg(org.id, authData.user.id);
  console.log("\n── Seed result ─────────────────────────────");
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nElapsed: ${(result.elapsedMs / 1000).toFixed(2)}s`);
  console.log(`Org id (for manual inspection/cleanup): ${org.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Benchmark failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
