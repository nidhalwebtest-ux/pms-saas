/**
 * Multi-tenancy helpers — single source of truth for org-scoped auth checks.
 * Every server action that touches org-owned data should call requireOrgUser().
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/current-user";

export interface OrgUser {
  userId: string;
  organizationId: string;
  role?: string;
}

/**
 * Returns the authenticated user's id and organizationId.
 * Throws an object `{ error: string }` if the user is not authenticated
 * or does not belong to an organization yet. Auth is resolved once per request
 * (React.cache) so repeated calls within a render are free.
 */
export async function requireOrgUser(): Promise<OrgUser> {
  const dbUser = await getSessionUser();
  if (!dbUser) throw { error: "Unauthorized" };
  if (!dbUser.organizationId) throw { error: "No organization found" };
  return { userId: dbUser.id, organizationId: dbUser.organizationId, role: dbUser.role ?? undefined };
}

/**
 * Asserts that a tenant belongs to the given org.
 * Returns the tenant id if valid, throws `{ error }` otherwise.
 */
export async function assertTenantOwnership(
  tenantId: string,
  organizationId: string,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this tenant" };
  }
}

/**
 * Asserts that a unit belongs to the given org (via its property).
 */
export async function assertUnitOwnership(
  unitId: string,
  organizationId: string,
): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this unit" };
  }
}

/**
 * Asserts that a reservation belongs to the given org (via tenant.organizationId).
 * NOTE: We use tenant instead of unit because unitId is nullable on multi-unit reservations.
 */
export async function assertReservationOwnership(
  reservationId: string,
  organizationId: string,
): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { tenant: { select: { organizationId: true } } },
  });
  if (!reservation || reservation.tenant.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this reservation" };
  }
}

/**
 * Asserts that a payment belongs to the given org (via its tenant).
 */
export async function assertPaymentOwnership(
  paymentId: string,
  organizationId: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { tenant: { select: { organizationId: true } } },
  });
  if (!payment || payment.tenant?.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this payment" };
  }
}

/**
 * Asserts that an invoice belongs to the given org.
 */
export async function assertInvoiceOwnership(
  invoiceId: string,
  organizationId: string,
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { organizationId: true },
  });
  if (!invoice || invoice.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this invoice" };
  }
}

/**
 * Asserts that an expense belongs to the given org (via its property).
 */
export async function assertExpenseOwnership(
  expenseId: string,
  organizationId: string,
): Promise<void> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { property: { select: { organizationId: true } } },
  });
  if (!expense || expense.property.organizationId !== organizationId) {
    throw { error: "Unauthorized access to this expense" };
  }
}
