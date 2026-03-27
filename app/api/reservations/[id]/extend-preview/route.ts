import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { collapseToSegments, roundOMR } from "@/lib/reservation-engine";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const newCheckOutDateStr = searchParams.get("newCheckOutDate");
  if (!newCheckOutDateStr) {
    return NextResponse.json({ error: "newCheckOutDate is required" }, { status: 400 });
  }

  // Load reservation
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        where: { isMovedOut: false },
        include: {
          unit: {
            select: { id: true, name: true, floor: true, unitType: true, propertyId: true, property: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!r || r.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const currentEndDate = new Date(r.endDate);
  currentEndDate.setHours(0, 0, 0, 0);
  const newCheckOut = new Date(newCheckOutDateStr);
  newCheckOut.setHours(0, 0, 0, 0);

  if (newCheckOut <= currentEndDate) {
    return NextResponse.json(
      { error: "New checkout date must be after current checkout date" },
      { status: 400 },
    );
  }

  // For each active unit, check availability and compute pricing
  const unitResults = await Promise.all(
    r.reservationUnits.map(async (ru) => {
      const unitId = ru.unitId;
      const unitName = ru.unit.name;
      const propertyName = ru.unit.property.name;

      // The start of the extension window
      const effectiveCheckOutDate = ru.effectiveCheckOut
        ? new Date(ru.effectiveCheckOut)
        : new Date(r.endDate);
      effectiveCheckOutDate.setHours(0, 0, 0, 0);

      // Check availability: look for other reservations that conflict with [effectiveCheckOut, newCheckOut)
      const conflictingReservation = await prisma.reservation.findFirst({
        where: {
          id: { not: id }, // exclude current reservation
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
          OR: [
            // Old-style: reservation.unitId
            {
              unitId: unitId,
              startDate: { lt: newCheckOut },
              endDate: { gt: effectiveCheckOutDate },
            },
            // New-style: ReservationUnit junction
            {
              reservationUnits: {
                some: {
                  unitId: unitId,
                  isMovedOut: false,
                },
              },
              startDate: { lt: newCheckOut },
              endDate: { gt: effectiveCheckOutDate },
            },
          ],
        },
        include: {
          tenant: { select: { firstName: true, lastName: true } },
        },
      });

      if (conflictingReservation) {
        return {
          unitId,
          unitName,
          propertyName,
          effectiveCheckOut: effectiveCheckOutDate.toISOString(),
          available: false,
          conflict: {
            reservationNumber: conflictingReservation.reservationNumber,
            guestFirstName: conflictingReservation.tenant.firstName,
            guestLastName: conflictingReservation.tenant.lastName,
            fromDate: conflictingReservation.startDate.toISOString(),
          },
          extensionSubtotal: 0,
        };
      }

      // Available — calculate pricing
      const priceResult = await getUnitPriceForRange(unitId, effectiveCheckOutDate, newCheckOut);
      const segments = collapseToSegments(priceResult.dailyBreakdown).map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        nights: s.nights,
        ratePerNight: s.ratePerNight,
        subtotal: s.subtotal,
        priceName: s.priceName,
      }));
      const extensionSubtotal = roundOMR(priceResult.totalAmount);

      return {
        unitId,
        unitName,
        propertyName,
        effectiveCheckOut: effectiveCheckOutDate.toISOString(),
        available: true,
        segments,
        extensionSubtotal,
      };
    }),
  );

  const allAvailable = unitResults.every((u) => u.available);
  const someAvailable = unitResults.some((u) => u.available);
  const extensionTotal = roundOMR(
    unitResults.filter((u) => u.available).reduce((s, u) => s + u.extensionSubtotal, 0),
  );

  const previousGrandTotal = roundOMR(Number(r.grandTotal));
  const previousAmountPaid = roundOMR(Number(r.amountPaid));
  const newGrandTotal = roundOMR(previousGrandTotal + extensionTotal);
  const newBalanceDue = roundOMR(newGrandTotal - previousAmountPaid);

  return NextResponse.json({
    reservationId: id,
    currentCheckOut: currentEndDate.toISOString(),
    newCheckOut: newCheckOut.toISOString(),
    units: unitResults,
    summary: {
      allAvailable,
      someAvailable,
      extensionTotal,
      previousGrandTotal,
      previousAmountPaid,
      newGrandTotal,
      newBalanceDue,
    },
  });
}
