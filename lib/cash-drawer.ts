import type { Prisma } from "@prisma/client";

/**
 * Cash-drawer plumbing. A cash drawer is a per-building monetary account
 * (BankAccount with type=CASH, one per Property). Cash payments, cash refunds
 * and petty-cash expenses flow through the building's drawer using the same
 * signed BankTransaction ledger as bank accounts — so the daily cashier
 * statement (Phase 2) is just `getBankStatement` over the drawer.
 *
 * Drawers are auto-created on first cash movement with a zero opening float, so
 * reception is never blocked; the manager sets the real float later in the Cash
 * Drawers settings. Pass a transaction client (`tx`) so the drawer + its ledger
 * row are written atomically with the source payment/expense.
 */

/** Resolve the building (propertyId) a cash movement belongs to. */
export async function resolveDrawerProperty(
  tx: Prisma.TransactionClient,
  args: { reservationId?: string | null; invoiceId?: string | null },
): Promise<string | null> {
  // Prefer the reservation's unit(s); a reservation lives in one building.
  if (args.reservationId) {
    const r = await tx.reservation.findUnique({
      where: { id: args.reservationId },
      select: {
        unit: { select: { propertyId: true } },
        reservationUnits: { select: { unit: { select: { propertyId: true } } }, take: 1 },
      },
    });
    const fromUnit = r?.unit?.propertyId ?? r?.reservationUnits[0]?.unit?.propertyId;
    if (fromUnit) return fromUnit;
  }
  // Fall back to the invoice's property, then its reservation's unit.
  if (args.invoiceId) {
    const inv = await tx.invoice.findUnique({
      where: { id: args.invoiceId },
      select: {
        propertyId: true,
        reservation: {
          select: {
            unit: { select: { propertyId: true } },
            reservationUnits: { select: { unit: { select: { propertyId: true } } }, take: 1 },
          },
        },
      },
    });
    const fromInvoice =
      inv?.propertyId ??
      inv?.reservation?.unit?.propertyId ??
      inv?.reservation?.reservationUnits[0]?.unit?.propertyId;
    if (fromInvoice) return fromInvoice;
  }
  return null;
}

/**
 * Get the org/building's cash drawer, creating it (zero float) if it doesn't
 * exist yet. Returns null only when no building can be resolved (cash then
 * stays out of any drawer, as it did before this feature).
 */
export async function getOrCreateCashDrawer(
  tx: Prisma.TransactionClient,
  orgId: string,
  propertyId: string | null,
) {
  if (!propertyId) return null;

  const existing = await tx.bankAccount.findFirst({
    where: { organizationId: orgId, type: "CASH", propertyId },
  });
  if (existing) return existing;

  return tx.bankAccount.create({
    data: {
      organizationId: orgId,
      type:           "CASH",
      propertyId,
      bankName:       "Cash Drawer",
      currency:       "OMR",
      openingBalance: "0",
      isActive:       true,
      isDefault:      false,
    },
  });
}
