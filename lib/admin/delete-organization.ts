import type { PrismaClient } from "@prisma/client";

/**
 * Permanently delete an organization and EVERYTHING that belongs to it.
 *
 * Most foreign keys in this schema do NOT cascade from Organization (Tenant,
 * Payment, Expense, CashierSession, User… are RESTRICT), so a plain
 * `organization.delete` fails as soon as the org has any data. This deletes
 * children before parents, every table explicitly, in ONE transaction — it
 * either removes the whole org or nothing.
 *
 * When a table is added to the schema with an organizationId (or a path to
 * one), add it here. tests: scripts/test-delete-organization.ts builds an org
 * with a row in every org-scoped table and asserts nothing is left behind and
 * a second org is untouched.
 *
 * Supabase Auth accounts are NOT touched here — the caller deletes them after
 * this succeeds (see the admin server action), using the returned user ids.
 */
export async function deleteOrganizationData(
  db: PrismaClient,
  organizationId: string,
): Promise<{ userIds: string[] }> {
  const org = { organizationId };

  const users = await db.user.findMany({ where: org, select: { id: true } });
  const userIds = users.map((u) => u.id);

  await db.$transaction(
    [
      // ── Loose references (no FK) and website inbox ────────────────────────
      db.shareLink.deleteMany({ where: org }),
      db.whatsAppMessage.deleteMany({ where: org }),
      db.whatsAppTemplate.deleteMany({ where: org }),
      db.whatsAppAccount.deleteMany({ where: org }),
      db.salesTarget.deleteMany({ where: org }),
      db.websiteBookingRequest.deleteMany({ where: org }),

      // ── Bank / cashier reconciliation ─────────────────────────────────────
      db.bankStatementLine.deleteMany({ where: org }),
      db.bankTransaction.deleteMany({ where: org }),

      // ── Money: allocations → payments → returns → invoices ────────────────
      db.paymentAllocation.deleteMany({ where: org }),
      // Legacy payments may have a null organizationId — catch them via tenant.
      db.payment.deleteMany({
        where: { OR: [{ organizationId }, { tenant: { organizationId } }] },
      }),
      db.returnLineItem.deleteMany({ where: org }),
      db.return.deleteMany({ where: { OR: [{ organizationId }, { tenant: { organizationId } }] } }),
      db.invoiceLineItem.deleteMany({ where: org }),
      db.invoice.deleteMany({ where: { OR: [{ organizationId }, { tenant: { organizationId } }] } }),

      // ── Operations ────────────────────────────────────────────────────────
      db.expense.deleteMany({ where: org }),
      db.cashierSession.deleteMany({ where: org }),
      db.reservationCharge.deleteMany({ where: org }),
      db.reservationActivity.deleteMany({ where: org }),
      db.reservationUnit.deleteMany({ where: { reservation: { organizationId } } }),
      db.reservation.deleteMany({ where: { OR: [{ organizationId }, { tenant: { organizationId } }] } }),
      db.tenant.deleteMany({ where: org }),

      // ── Setup data ────────────────────────────────────────────────────────
      db.vendor.deleteMany({ where: org }),
      db.expenseCat.deleteMany({ where: org }),
      db.bankAccount.deleteMany({ where: org }),
      db.importJob.deleteMany({ where: org }), // rows cascade
      // Buildings → units → unit prices / notes / building assignments cascade.
      db.property.deleteMany({ where: org }),
      db.invitation.deleteMany({ where: org }),
      db.orgWebsite.deleteMany({ where: org }),

      // ── People, roles, the org itself ─────────────────────────────────────
      db.user.deleteMany({ where: org }),
      db.role.deleteMany({ where: org }),
      db.organization.delete({ where: { id: organizationId } }),
    ],
    { isolationLevel: "ReadCommitted" },
  );

  return { userIds };
}
