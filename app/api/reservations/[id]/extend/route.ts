import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { roundOMR, calculateNights, countCalendarMonths } from "@/lib/reservation-engine";

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

interface ExtendBody {
  newCheckOutDate: string;
  unitExtensions: Array<{ unitId: string; extend: boolean }>;
  /** Custom rate overrides keyed by unitId — user-entered in the modal */
  customRates?: Record<string, number>;
  payment?: { amount: number; method: string; reference?: string };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: ExtendBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { newCheckOutDate, unitExtensions, customRates = {}, payment } = body;
  if (!newCheckOutDate || !unitExtensions || !Array.isArray(unitExtensions)) {
    return NextResponse.json({ error: "newCheckOutDate and unitExtensions are required" }, { status: 400 });
  }

  // NOTE: isMovedOut: { not: true } matches both false AND null (legacy records)
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        where: { isMovedOut: { not: true } },
        include: { unit: { select: { id: true, name: true } } },
      },
    },
  });

  if (!r || r.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const originalEndDate = new Date(r.endDate);
  originalEndDate.setHours(0, 0, 0, 0);
  const newCheckOut = new Date(newCheckOutDate);
  newCheckOut.setHours(0, 0, 0, 0);

  if (newCheckOut <= originalEndDate) {
    return NextResponse.json(
      { error: "New checkout date must be after current checkout date" },
      { status: 400 },
    );
  }

  const extensionMap = new Map<string, boolean>();
  for (const ue of unitExtensions) extensionMap.set(ue.unitId, ue.extend);

  // Verify availability + compute pricing outside the transaction
  const extendedUnitPricings = new Map<string, { additionalNights: number; additionalSubtotal: number }>();

  for (const ru of r.reservationUnits) {
    const shouldExtend = extensionMap.get(ru.unitId) ?? false;
    if (!shouldExtend) continue;

    const extensionStart = ru.effectiveCheckOut ? new Date(ru.effectiveCheckOut) : new Date(r.endDate);
    extensionStart.setHours(0, 0, 0, 0);

    // Re-check availability
    const conflict = await prisma.reservation.findFirst({
      where: {
        id:     { not: id },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            unitId:    ru.unitId,
            startDate: { lt: newCheckOut },
            endDate:   { gt: extensionStart },
          },
          {
            reservationUnits: {
              some: { unitId: ru.unitId, isMovedOut: { not: true } },
            },
            startDate: { lt: newCheckOut },
            endDate:   { gt: extensionStart },
          },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Unit ${ru.unit.name} is not available for the requested extension period` },
        { status: 409 },
      );
    }

    // Determine extension rate (custom > DB price > existing reservation rate).
    // Monthly reservations bill in calendar-month chunks: customRate is treated
    // as the monthly rate and the extension is counted in calendar months, not
    // nights. Without this branch a "+1 month" extension would charge
    // monthlyRate × ~30 nights and inflate the invoice 30×.
    const isMonthly = ru.rateType === "monthly" || ru.rateType === "MONTHLY";
    const customRate = customRates[ru.unitId] ? Number(customRates[ru.unitId]) : null;

    let additionalSubtotal: number;
    let additionalNights:   number;

    if (isMonthly) {
      const months = countCalendarMonths(extensionStart, newCheckOut);
      additionalNights = calculateNights(extensionStart, newCheckOut);
      const monthlyRate = customRate !== null && customRate > 0
        ? customRate
        : roundOMR(Number(ru.rateAmount));
      additionalSubtotal = roundOMR(monthlyRate * months);
    } else {
      const extensionNights = calculateNights(extensionStart, newCheckOut);
      additionalNights = extensionNights;
      if (customRate !== null && customRate > 0) {
        additionalSubtotal = roundOMR(customRate * extensionNights);
      } else {
        const pricing = await getUnitPriceForRange(ru.unitId, extensionStart, newCheckOut);
        if (pricing.totalAmount > 0) {
          additionalSubtotal = roundOMR(pricing.totalAmount);
        } else {
          // Fall back to the rate already on this reservation unit
          const fallbackRate = roundOMR(Number(ru.rateAmount));
          additionalSubtotal = roundOMR(fallbackRate * extensionNights);
        }
      }
    }

    extendedUnitPricings.set(ru.unitId, { additionalNights, additionalSubtotal });
  }

  let newGrandTotal = 0;
  let additionalCharges = 0;

  await prisma.$transaction(
    async (tx) => {
      // Units NOT being extended: pin their effectiveCheckOut to the original end date
      for (const ru of r.reservationUnits) {
        if (!(extensionMap.get(ru.unitId) ?? false)) {
          await tx.reservationUnit.update({
            where: { id: ru.id },
            data:  { effectiveCheckOut: originalEndDate },
          });
        }
      }

      // Units being extended: update nights + subtotal
      for (const ru of r.reservationUnits) {
        if (!(extensionMap.get(ru.unitId) ?? false)) continue;
        const ext = extendedUnitPricings.get(ru.unitId);
        if (!ext) continue;

        const newNights   = ru.nights + ext.additionalNights;
        const newSubtotal = roundOMR(Number(ru.subtotal) + ext.additionalSubtotal);
        additionalCharges = roundOMR(additionalCharges + ext.additionalSubtotal);

        await tx.reservationUnit.update({
          where: { id: ru.id },
          data:  { nights: newNights, subtotal: newSubtotal },
        });
      }

      // Recalculate reservation totals from updated RUs
      const allActiveRUs = await tx.reservationUnit.findMany({
        where:  { reservationId: id, isMovedOut: { not: true } },
        select: { subtotal: true },
      });
      const newTotalAmount  = roundOMR(allActiveRUs.reduce((s, ru) => s + Number(ru.subtotal), 0));
      const discountAmount  = roundOMR(Number(r.discountAmount));
      const newGrand        = roundOMR(newTotalAmount - discountAmount);
      const totalNights     = calculateNights(new Date(r.startDate), newCheckOut);
      newGrandTotal         = newGrand;

      let newAmountPaid = roundOMR(Number(r.amountPaid));
      if (payment && Number(payment.amount) > 0) {
        const payAmt = roundOMR(Number(payment.amount));
        await tx.payment.create({
          data: {
            amount: payAmt, method: payment.method as any,
            reference: payment.reference ?? null,
            tenantId: r.tenantId, reservationId: id,
          },
        });
        newAmountPaid = roundOMR(newAmountPaid + payAmt);
        await tx.reservationActivity.create({
          data: {
            reservationId: id, organizationId: actor.organizationId!,
            action: "PAYMENT_RECORDED",
            description: `Payment of ${payAmt.toFixed(3)} OMR recorded at stay extension (${payment.method})`,
            performedById: actor.id,
            metadata: { amount: payAmt, method: payment.method, atExtension: true },
          },
        });
      }

      await tx.reservation.update({
        where: { id },
        data: {
          endDate: newCheckOut, totalAmount: newTotalAmount,
          grandTotal: newGrand, amountPaid: newAmountPaid, totalNights,
        },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id, organizationId: actor.organizationId!,
          action: "EXTENDED",
          description: `Stay extended from ${originalEndDate.toISOString().slice(0, 10)} to ${newCheckOut.toISOString().slice(0, 10)}. Additional charges: ${additionalCharges.toFixed(3)} OMR.`,
          performedById: actor.id,
          metadata: {
            originalEndDate: originalEndDate.toISOString(),
            newEndDate:      newCheckOut.toISOString(),
            additionalCharges,
            extendedUnits:   Array.from(extendedUnitPricings.keys()),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return NextResponse.json({ success: true, newEndDate: newCheckOut.toISOString(), newGrandTotal, additionalCharges });
}
