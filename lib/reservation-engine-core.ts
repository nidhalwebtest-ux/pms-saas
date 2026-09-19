import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateNights, calculateGrandTotal } from "@/lib/reservation-engine";
import { getUnitConflict, type ConflictDetail } from "@/lib/reservation-conflict";
import { computeUnitPricings, findMonthlyBlock, type UnitOverride } from "@/lib/reservation-pricing";
import { generateReservationNumber } from "@/lib/reservation-number";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";

/* ============================================================================
 *  Reservation creation — shared core used by POST /api/reservations (the
 *  booking engine UI) and the CSV/Excel import adapter
 *  (lib/import/adapters/reservations.ts), same write path so imported
 *  reservations get the same numbering, availability check (Serializable
 *  transaction against double-booking), pricing engine, and invoice-on-create
 *  behavior as one entered by hand. Mirrors createPropertyCore/
 *  createExpenseCore's role for Buildings/Expenses.
 * ========================================================================= */

export class MonthlyBlockedError extends Error {
  constructor(public unitId: string, public seasonName: string | null) {
    super(`monthly_blocked:${unitId}`);
  }
}

export class DoubleBookingError extends Error {
  constructor(public conflict: ConflictDetail) {
    super("double_booking");
  }
}

export interface CreateReservationInput {
  tenantId: string;
  unitIds: string[];
  /** unitId -> display name, used only to label a double-booking conflict error. */
  unitNames?: Record<string, string>;
  startDate: Date;
  endDate: Date;
  rateType: "daily" | "monthly";
  source?: string;
  notes?: string | null;
  discountAmount?: number;
  unitOverrides?: UnitOverride[];
}

/**
 * Creates a reservation with its ReservationUnit rows, in a Serializable
 * transaction that re-checks unit availability immediately before the write
 * (double-booking prevention — see lib/reservation-conflict.ts). Then, outside
 * the transaction, best-effort generates invoice(s) if the org's invoice
 * timing setting is ON_CREATE (failure there doesn't fail the booking, same
 * as the route).
 *
 * Does NOT validate that tenantId/unitIds belong to the organization —
 * callers must do that first (both the API route and the import adapter's
 * validateRow already do, each against their own inputs), since this core
 * has no request/session context to check against.
 */
export async function createReservationCore(
  input: CreateReservationInput,
  organizationId: string,
  userId: string,
): Promise<{ id: string }> {
  const { tenantId, unitIds, startDate, endDate, rateType, unitOverrides = [] } = input;

  if (rateType === "monthly") {
    const block = await findMonthlyBlock(unitIds, startDate, endDate);
    if (block) throw new MonthlyBlockedError(block.unitId, block.name);
  }

  const unitPricings = await computeUnitPricings(unitIds, rateType, startDate, endDate, unitOverrides);
  const totalNights = calculateNights(startDate, endDate);
  const discount = Math.max(0, Number(input.discountAmount) || 0);
  const grandResult = calculateGrandTotal(unitPricings.map((u) => u.subtotal), discount);

  const orgInvoiceSettings = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { dailyInvoiceTiming: true, monthlyInvoiceTiming: true },
  });
  const invoiceTiming = rateType === "monthly" ? orgInvoiceSettings?.monthlyInvoiceTiming : orgInvoiceSettings?.dailyInvoiceTiming;
  const generateOnCreate = invoiceTiming === "ON_CREATE";

  const reservation = await prisma.$transaction(
    async (tx) => {
      for (const unitId of unitIds) {
        const unitName = input.unitNames?.[unitId] ?? unitId;
        const conflict = await getUnitConflict(tx, unitId, unitName, startDate, endDate);
        if (conflict) throw new DoubleBookingError(conflict);
      }

      const resNumber = await generateReservationNumber(organizationId, tx);

      const res = await tx.reservation.create({
        data: {
          reservationNumber: resNumber,
          organizationId,
          startDate,
          endDate,
          status: "PENDING",
          rateType,
          source: input.source ?? "walk_in",
          notes: input.notes ?? null,
          frequency: rateType === "monthly" ? "MONTHLY" : "DAILY",
          totalNights,
          amount: grandResult.grandTotal,
          totalPrice: grandResult.grandTotal,
          totalAmount: grandResult.totalAmount,
          discountAmount: grandResult.discountAmount,
          taxAmount: grandResult.taxAmount,
          grandTotal: grandResult.grandTotal,
          amountPaid: 0,
          tenantId,
          unitId: unitIds.length === 1 ? unitIds[0] : null,
          createdById: userId,
        },
      });

      await tx.reservationUnit.createMany({
        data: unitPricings.map((up) => ({
          reservationId: res.id,
          unitId: up.unitId,
          rateType: up.rateType,
          rateAmount: up.rateAmount,
          rateSource: up.rateSource,
          seasonalPriceName: up.seasonalPriceName,
          nights: up.nights,
          subtotal: up.subtotal,
          pricingSegments: up.pricingSegments as unknown as Prisma.InputJsonValue,
        })),
      });

      return res;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (generateOnCreate) {
    try {
      await generateInvoicesForReservation(reservation.id, organizationId, userId);
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { invoicesGenerated: true, invoicesGeneratedAt: new Date(), invoicesGeneratedById: userId },
      });
    } catch (e) {
      console.error("[createReservationCore] generate-on-create failed:", e);
    }
  }

  return { id: reservation.id };
}
