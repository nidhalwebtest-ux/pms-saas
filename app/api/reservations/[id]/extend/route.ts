import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { roundOMR, calculateNights } from "@/lib/reservation-engine";

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

  const { newCheckOutDate, unitExtensions, payment } = body;
  if (!newCheckOutDate || !unitExtensions || !Array.isArray(unitExtensions)) {
    return NextResponse.json({ error: "newCheckOutDate and unitExtensions are required" }, { status: 400 });
  }

  // Load reservation with active units
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        where: { isMovedOut: false },
        include: {
          unit: { select: { id: true, name: true } },
        },
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

  // Map extensions for quick lookup
  const extensionMap = new Map<string, boolean>();
  for (const ue of unitExtensions) {
    extensionMap.set(ue.unitId, ue.extend);
  }

  // Verify availability for units being extended, and compute pricing outside TX
  const extendedUnitPricings: Map<string, { additionalNights: number; additionalSubtotal: number }> = new Map();

  for (const ru of r.reservationUnits) {
    const shouldExtend = extensionMap.get(ru.unitId) ?? false;
    if (!shouldExtend) continue;

    // The extension window starts at the unit's effective checkout (or reservation end)
    const extensionStart = ru.effectiveCheckOut ? new Date(ru.effectiveCheckOut) : new Date(r.endDate);
    extensionStart.setHours(0, 0, 0, 0);

    // Re-check availability
    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: id },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            unitId: ru.unitId,
            startDate: { lt: newCheckOut },
            endDate: { gt: extensionStart },
          },
          {
            reservationUnits: {
              some: {
                unitId: ru.unitId,
                isMovedOut: false,
              },
            },
            startDate: { lt: newCheckOut },
            endDate: { gt: extensionStart },
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

    // Calculate extension pricing
    const pricing = await getUnitPriceForRange(ru.unitId, extensionStart, newCheckOut);
    extendedUnitPricings.set(ru.unitId, {
      additionalNights: pricing.nights,
      additionalSubtotal: roundOMR(pricing.totalAmount),
    });
  }

  // Execute in a serializable transaction
  let newGrandTotal = 0;
  let additionalCharges = 0;

  await prisma.$transaction(
    async (tx) => {
      // For units NOT being extended: set effectiveCheckOut = originalEndDate
      for (const ru of r.reservationUnits) {
        const shouldExtend = extensionMap.get(ru.unitId) ?? false;
        if (!shouldExtend) {
          await tx.reservationUnit.update({
            where: { id: ru.id },
            data: { effectiveCheckOut: originalEndDate },
          });
        }
      }

      // For units being extended: update nights and subtotal
      for (const ru of r.reservationUnits) {
        const shouldExtend = extensionMap.get(ru.unitId) ?? false;
        if (!shouldExtend) continue;

        const ext = extendedUnitPricings.get(ru.unitId);
        if (!ext) continue;

        const newNights = ru.nights + ext.additionalNights;
        const newSubtotal = roundOMR(Number(ru.subtotal) + ext.additionalSubtotal);
        additionalCharges = roundOMR(additionalCharges + ext.additionalSubtotal);

        await tx.reservationUnit.update({
          where: { id: ru.id },
          data: {
            nights: newNights,
            subtotal: newSubtotal,
          },
        });
      }

      // Update reservation endDate
      await tx.reservation.update({
        where: { id },
        data: { endDate: newCheckOut },
      });

      // Recalculate totals: reload all non-moved-out RUs with updated data
      const allActiveRUs = await tx.reservationUnit.findMany({
        where: { reservationId: id, isMovedOut: false },
        select: { subtotal: true, nights: true },
      });

      const newTotalAmount = roundOMR(
        allActiveRUs.reduce((s, ru) => s + Number(ru.subtotal), 0),
      );
      const discountAmount = roundOMR(Number(r.discountAmount));
      const newGrand = roundOMR(newTotalAmount - discountAmount);
      const totalNights = calculateNights(new Date(r.startDate), newCheckOut);

      newGrandTotal = newGrand;

      // Handle payment
      let newAmountPaid = roundOMR(Number(r.amountPaid));
      if (payment && Number(payment.amount) > 0) {
        const payAmt = roundOMR(Number(payment.amount));
        await tx.payment.create({
          data: {
            amount: payAmt,
            method: payment.method as any,
            reference: payment.reference ?? null,
            tenantId: r.tenantId,
            reservationId: id,
          },
        });
        newAmountPaid = roundOMR(newAmountPaid + payAmt);

        await tx.reservationActivity.create({
          data: {
            reservationId: id,
            organizationId: actor.organizationId!,
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
          endDate: newCheckOut,
          totalAmount: newTotalAmount,
          grandTotal: newGrand,
          amountPaid: newAmountPaid,
          totalNights,
        },
      });

      // Activity log
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          organizationId: actor.organizationId!,
          action: "EXTENDED",
          description: `Stay extended from ${originalEndDate.toISOString().slice(0, 10)} to ${newCheckOut.toISOString().slice(0, 10)}. Additional charges: ${additionalCharges.toFixed(3)} OMR.`,
          performedById: actor.id,
          metadata: {
            originalEndDate: originalEndDate.toISOString(),
            newEndDate: newCheckOut.toISOString(),
            additionalCharges,
            extendedUnits: Array.from(extendedUnitPricings.keys()),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return NextResponse.json({
    success: true,
    newEndDate: newCheckOut.toISOString(),
    newGrandTotal,
    additionalCharges,
  });
}
