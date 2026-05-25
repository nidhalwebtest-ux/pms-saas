#!/usr/bin/env tsx
/* ============================================================================
 *  Salalah PMS — test data seeder
 *
 *  Generates ~2,200 records covering daily + monthly reservations, seasonal
 *  pricing (Khareef 2025/2026 + Eid 2026), payments, returns, expenses, and
 *  unit-status edge cases. Deterministic; re-running produces the same data.
 *
 *  Run with:   npm run seed:test
 *  Verify with: npm run verify:integrity
 *
 *  Scope of deletion: the two test orgs (`Al Noor Property Management`
 *  + `Salalah Suites`) and their Supabase auth users — production data
 *  on other orgs is never touched.
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { resetRand } from "./_seed/rand";
import { TODAY } from "./_seed/dates";

import { runSetup,     type SetupResult }     from "./_seed/setup";
import { runTenants,   type TenantsResult }   from "./_seed/tenants";
import { runReservations, type ReservationsResult } from "./_seed/reservations";
import { runFinancials, type FinancialsResult } from "./_seed/financials";

/* ── Test org names — the deletion sweep keys off these ─────────────────── */
const TEST_ORG_NAMES = [
  "Al Noor Property Management",
  "Salalah Suites",
];

/* ── Test user emails — the auth sweep keys off these ───────────────────── */
const TEST_USER_EMAILS = [
  "ahmed@alnoor.test",
  "mansour@alnoor.test",
  "fatima@alnoor.test",
  "sara@alnoor.test",
  "khalid@alnoor.test",
  "omar@salalah.test",
];

async function main() {
  const started = Date.now();
  resetRand();

  console.log("\n────────────────────────────────────────────────");
  console.log("Salalah PMS — Test Data Seeder");
  console.log("────────────────────────────────────────────────");
  console.log(`Today (pinned):  ${TODAY.toISOString().slice(0, 10)}`);
  console.log("");

  /* ── Step 0 — cleanup ─────────────────────────────────────────────── */
  await cleanup();

  /* ── Step 1-7 — phased build ──────────────────────────────────────── */
  const setup        = await runSetup();
  const tenants      = await runTenants(setup);
  const reservations = await runReservations(setup, tenants);
  const financials   = await runFinancials(setup, tenants, reservations);

  /* ── Summary ─────────────────────────────────────────────────────────── */
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  printSummary(setup, tenants, reservations, financials, elapsed);
}

/* ============================================================================
 *  Cleanup — wipe everything belonging to the test orgs, then drop the
 *  matching Supabase auth users. Prisma's onDelete: Cascade chains handle
 *  the dependent rows (units → unit-prices, reservations → invoices →
 *  payments, etc.) so we only need to delete at the org level.
 * ========================================================================= */
async function cleanup(): Promise<void> {
  console.log("⤵︎  Cleaning previous test data…");

  // Existing test orgs (none on first run).
  const orgs = await prisma.organization.findMany({
    where: { name: { in: TEST_ORG_NAMES } },
    select: { id: true, name: true },
  });

  if (orgs.length > 0) {
    // Some FK chains do not cascade (e.g. PaymentAllocation → Payment, when
    // organizationId on Payment is nullable for legacy rows). Delete in
    // dependency order to be safe.
    const orgIds = orgs.map((o) => o.id);

    await prisma.$transaction([
      prisma.returnLineItem.deleteMany({ where: { organizationId: { in: orgIds } } }),
      prisma.return.deleteMany({         where: { organizationId: { in: orgIds } } }),
      prisma.paymentAllocation.deleteMany({ where: { organizationId: { in: orgIds } } }),
      prisma.payment.deleteMany({        where: { organizationId: { in: orgIds } } }),
      prisma.invoiceLineItem.deleteMany({ where: { organizationId: { in: orgIds } } }),
      prisma.invoice.deleteMany({        where: { organizationId: { in: orgIds } } }),
      prisma.reservationActivity.deleteMany({ where: { organizationId: { in: orgIds } } }),
      prisma.reservationUnit.deleteMany({ where: { reservation: { tenant: { organizationId: { in: orgIds } } } } }),
      prisma.reservation.deleteMany({    where: { tenant: { organizationId: { in: orgIds } } } }),
      prisma.expense.deleteMany({        where: { organizationId: { in: orgIds } } }),
      prisma.expenseCat.deleteMany({     where: { organizationId: { in: orgIds } } }),
      prisma.tenant.deleteMany({         where: { organizationId: { in: orgIds } } }),
      prisma.unitPrice.deleteMany({      where: { unit: { property: { organizationId: { in: orgIds } } } } }),
      prisma.unit.deleteMany({           where: { property: { organizationId: { in: orgIds } } } }),
      prisma.property.deleteMany({       where: { organizationId: { in: orgIds } } }),
      prisma.user.deleteMany({           where: { organizationId: { in: orgIds } } }),
      prisma.organization.deleteMany({   where: { id: { in: orgIds } } }),
    ]);

    console.log(`   • ${orgs.length} test org(s) wiped.`);
  } else {
    console.log("   • No previous test data found.");
  }

  // Drop matching auth users so createUser() re-runs cleanly.
  const admin = createAdminClient();
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const matches = list.data.users.filter((u) => u.email && TEST_USER_EMAILS.includes(u.email));
  for (const u of matches) {
    await admin.auth.admin.deleteUser(u.id);
    // Light rate-limit guard.
    await sleep(80);
  }
  if (matches.length > 0) {
    console.log(`   • ${matches.length} Supabase auth user(s) deleted.`);
  }
  console.log("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================================================================
 *  Summary table — printed at the end of every successful run.
 * ========================================================================= */
function printSummary(
  setup: SetupResult,
  tenants: TenantsResult,
  reservations: ReservationsResult,
  financials: FinancialsResult,
  elapsed: string,
): void {
  console.log("\n────────────────────────────────────────────────");
  console.log("  Seed complete");
  console.log("────────────────────────────────────────────────");
  console.log(`  Duration:           ${elapsed} s`);
  console.log("");
  console.log("  Organisations:      " + setup.orgs.length);
  console.log("  Users:              " + setup.users.length);
  console.log("  Properties:         " + setup.properties.length);
  console.log("  Units:              " + setup.units.length);
  console.log("  Unit prices:        " + setup.unitPrices);
  console.log("  Expense categories: " + setup.expenseCats);
  console.log("  Tenants:            " + tenants.tenants.length);
  console.log("  Reservations:       " + reservations.created);
  console.log("    └ daily:          " + reservations.daily);
  console.log("    └ monthly:        " + reservations.monthly);
  console.log("  Invoices:           " + financials.invoices);
  console.log("  Payments:           " + financials.payments);
  console.log("  Returns:            " + financials.returns);
  console.log("  Expenses:           " + financials.expenses);
  console.log("");
  console.log("  Financials (Al Noor):");
  console.log("    Total invoiced:   " + financials.totalInvoiced.toFixed(3) + " OMR");
  console.log("    Total paid:       " + financials.totalPaid.toFixed(3) + " OMR");
  console.log("    Outstanding:      " + financials.outstanding.toFixed(3) + " OMR");
  console.log("");
  console.log("  Login:");
  console.log("    Admin:        ahmed@alnoor.test    / Test1234!");
  console.log("    Manager:      mansour@alnoor.test  / Test1234!");
  console.log("    Receptionist: fatima@alnoor.test   / Test1234!");
  console.log("    Receptionist: sara@alnoor.test     / Test1234!");
  console.log("    Accountant:   khalid@alnoor.test   / Test1234!");
  console.log("    Salalah Adm.: omar@salalah.test    / Test1234!");
  console.log("");
  console.log("  Next: npm run verify:integrity");
  console.log("────────────────────────────────────────────────\n");
}

/* ── Entry point ─────────────────────────────────────────────────────── */
main()
  .catch((err) => {
    console.error("\n✗ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
