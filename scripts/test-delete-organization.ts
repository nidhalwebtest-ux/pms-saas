/**
 * Verifies lib/admin/delete-organization.ts against a REAL Postgres.
 *
 *   DATABASE_URL=postgresql://…/throwaway npx tsx scripts/test-delete-organization.ts
 *
 * ⚠ Point it at a throwaway database only (run `prisma db push` against it
 * first) — it writes fixture data and deletes an org. It refuses to run
 * against a supabase.co / pooler host.
 *
 * Builds two identical orgs with at least one row in EVERY org-scoped table,
 * deletes org A, then asserts: every table lost exactly org A's rows (so B is
 * untouched) and nothing references org A any more.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { deleteOrganizationData } from "@/lib/admin/delete-organization";

const url = process.env.DATABASE_URL ?? "";
if (!url || /supabase|pooler/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must be a throwaway local database.");
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });
const D = (s: string) => new Date(s);
const $ = (s: string) => new Prisma.Decimal(s);

async function makeOrg(tag: string) {
  const org = await db.organization.create({ data: { name: `Org ${tag}` } });
  const organizationId = org.id;
  const role = await db.role.create({ data: { organizationId, name: `Role ${tag}` } });
  const user = await db.user.create({
    data: { id: crypto.randomUUID(), email: `${tag}@test.local`, organizationId, roleId: role.id },
  });
  const property = await db.property.create({ data: { organizationId, name: `Tower ${tag}` } });
  await db.propertyAssignment.create({ data: { userId: user.id, propertyId: property.id } });
  const unit = await db.unit.create({ data: { name: "101", basePrice: $("20"), propertyId: property.id } });
  await db.unitPrice.create({ data: { unitId: unit.id, dailyRate: $("20"), monthlyRate: $("400") } });
  await db.unitNote.create({ data: { unitId: unit.id, userId: user.id, content: "note" } });
  const tenant = await db.tenant.create({
    data: { organizationId, firstName: "T", lastName: tag, phone: "+96890000000", createdById: user.id },
  });
  const reservation = await db.reservation.create({
    data: {
      organizationId, tenantId: tenant.id, unitId: unit.id, createdById: user.id,
      startDate: D("2026-01-01"), endDate: D("2026-01-05"), amount: $("80"),
    },
  });
  await db.reservationUnit.create({
    data: { reservationId: reservation.id, unitId: unit.id, rateAmount: $("20"), subtotal: $("80") },
  });
  await db.reservationActivity.create({
    data: { reservationId: reservation.id, organizationId, action: "CREATED", description: "x", performedById: user.id },
  });
  await db.reservationCharge.create({
    data: { reservationId: reservation.id, organizationId, description: "x", amount: $("5"), createdById: user.id },
  });
  const invoice = await db.invoice.create({
    data: {
      organizationId, invoiceNumber: `INV-${tag}`, reservationId: reservation.id, tenantId: tenant.id,
      propertyId: property.id, createdById: user.id,
      periodStart: D("2026-01-01"), periodEnd: D("2026-01-05"), dueDate: D("2026-01-05"),
      subtotal: $("80"), totalAmount: $("80"), balanceDue: $("30"),
    },
  });
  await db.invoiceLineItem.create({
    data: { invoiceId: invoice.id, organizationId, unitId: unit.id, description: "x", quantity: $("4"), unitPrice: $("20"), lineTotal: $("80") },
  });
  const bank = await db.bankAccount.create({ data: { organizationId, bankName: "Bank", propertyId: property.id } });
  const payment = await db.payment.create({
    data: {
      organizationId, tenantId: tenant.id, reservationId: reservation.id, invoiceId: invoice.id,
      bankAccountId: bank.id, receivedById: user.id, amount: $("50"),
    },
  });
  // A legacy payment with no organizationId — must still be found via tenant.
  await db.payment.create({ data: { tenantId: tenant.id, amount: $("1") } });
  await db.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, organizationId, amount: $("50") } });
  const ret = await db.return.create({
    data: {
      returnNumber: `RET-${tag}`, organizationId, reservationId: reservation.id, tenantId: tenant.id,
      invoiceId: invoice.id, returnFrom: D("2026-01-04"), returnTo: D("2026-01-05"), returnAmount: $("20"), reason: "x",
      createdById: user.id,
    },
  });
  await db.returnLineItem.create({
    data: { returnId: ret.id, organizationId, description: "x", quantity: $("1"), unitPrice: $("20"), lineTotal: $("20") },
  });
  const cat = await db.expenseCat.create({ data: { organizationId, name: `Cat ${tag}` } });
  const vendor = await db.vendor.create({ data: { organizationId, name: `Vendor ${tag}`, categoryId: cat.id } });
  const expense = await db.expense.create({
    data: {
      organizationId, expenseNumber: `EXP-${tag}`, categoryId: cat.id, vendorId: vendor.id, description: "x",
      amount: $("10"), propertyId: property.id, submittedById: user.id, reviewedById: user.id, bankAccountId: bank.id,
    },
  });
  const txn = await db.bankTransaction.create({
    data: { organizationId, bankAccountId: bank.id, type: "PAYMENT_IN", amount: $("50"), date: D("2026-01-02"), paymentId: payment.id },
  });
  await db.bankTransaction.create({
    data: { organizationId, bankAccountId: bank.id, type: "TRANSFER_OUT", amount: $("10"), date: D("2026-01-02"), expenseId: expense.id },
  });
  await db.bankStatementLine.create({
    data: { organizationId, bankAccountId: bank.id, date: D("2026-01-02"), amount: $("50"), matchedTxnId: txn.id },
  });
  await db.cashierSession.create({
    data: { organizationId, cashierId: user.id, businessDate: D("2026-01-02"), propertyId: property.id, depositBankAccountId: bank.id },
  });
  await db.invitation.create({
    data: { email: `inv-${tag}@test.local`, role: "STAFF", expiresAt: D("2030-01-01"), organizationId, invitedById: user.id },
  });
  await db.salesTarget.create({
    data: { organizationId, scope: "BUILDING", refId: property.id, periodType: "MONTHLY", periodStart: D("2026-01-01"), amount: $("100") },
  });
  const job = await db.importJob.create({
    data: { organizationId, recordType: "TENANTS", originalFilename: "t.csv", storagePath: "x", createdById: user.id },
  });
  await db.importJobRow.create({ data: { jobId: job.id, rowNumber: 1, rawData: {} } });
  await db.importJob.create({
    data: { organizationId, recordType: "TENANTS", originalFilename: "t2.csv", storagePath: "y", parentJobId: job.id },
  });
  await db.shareLink.create({ data: { code: `code-${tag}`, organizationId, docType: "invoice", docId: invoice.id } });
  const site = await db.orgWebsite.create({ data: { organizationId, slug: `site-${tag}` } });
  await db.websiteBookingRequest.create({
    data: {
      organizationId, orgWebsiteId: site.id, unitId: unit.id, buildingId: property.id, guestName: "G", guestPhone: "1",
      checkIn: D("2026-02-01"), checkOut: D("2026-02-03"), quotedTotal: $("40"),
    },
  });
  return { organizationId, userId: user.id };
}

/** Row count of every model, keyed by Prisma model name. */
async function countAll(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    const delegate = (db as unknown as Record<string, { count: () => Promise<number> }>)[
      m.name[0].toLowerCase() + m.name.slice(1)
    ];
    out[m.name] = await delegate.count();
  }
  return out;
}

async function main() {
  const A = await makeOrg("a");
  await makeOrg("b");
  const before = await countAll();

  const empty = Object.entries(before).filter(([, n]) => n === 0).map(([k]) => k);
  console.log("Tables with no fixture rows (expected: org-independent CRM/global tables):", empty.join(", "));

  const { userIds } = await deleteOrganizationData(db, A.organizationId);
  if (!userIds.includes(A.userId)) throw new Error("returned user ids are missing org A's user");

  const after = await countAll();
  const problems: string[] = [];
  for (const [model, n] of Object.entries(before)) {
    // Fixture is symmetric: every table should now hold exactly half (org B's rows).
    if (n > 0 && after[model] * 2 !== n) problems.push(`${model}: before ${n}, after ${after[model]} (expected ${n / 2})`);
  }
  if (await db.organization.findUnique({ where: { id: A.organizationId } })) problems.push("org A still exists");

  if (problems.length) {
    console.error("✗ FAILED\n" + problems.join("\n"));
    process.exit(1);
  }
  const touched = Object.values(before).filter((n) => n > 0).length;
  console.log(`✓ Org A fully deleted across ${touched} tables; org B untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
