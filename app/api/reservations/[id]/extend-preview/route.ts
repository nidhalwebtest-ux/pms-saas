import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { collapseToSegments, roundOMR, calculateNights } from "@/lib/reservation-engine";

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

  // NOTE: isMovedOut: { not: true } matches both false AND null (legacy records)
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        where: { isMovedOut: { not: true } },
        include: {
          unit: {
            select: {
              id: true, name: true, floor: true, unitType: true, propertyId: true,
              property: { select: { name: true } },
            },
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

  const unitResults = await Promise.all(
    r.reservationUnits.map(async (ru) => {
      const unitId      = ru.unitId;
      const unitName    = ru.unit.name;
      const propertyName = ru.unit.property.name;
      // The rate already stored on this reservation line — use as default
      const existingRate = roundOMR(Number(ru.rateAmount));

      const effectiveCheckOutDate = ru.effectiveCheckOut
        ? new Date(ru.effectiveCheckOut)
        : new Date(r.endDate);
      effectiveCheckOutDate.setHours(0, 0, 0, 0);

      // Availability check: conflicts with [effectiveCheckOut, newCheckOut)
      const conflictingReservation = await prisma.reservation.findFirst({
        where: {
          id:     { not: id },
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
          OR: [
            {
              unitId,
              startDate: { lt: newCheckOut },
              endDate:   { gt: effectiveCheckOutDate },
            },
            {
              reservationUnits: {
                some: { unitId, isMovedOut: { not: true } },
              },
              startDate: { lt: newCheckOut },
              endDate:   { gt: effectiveCheckOutDate },
            },
          ],
        },
        include: { tenant: { select: { firstName: true, lastName: true } } },
      });

      if (conflictingReservation) {
        return {
          unitId, unitName, propertyName,
          effectiveCheckOut: effectiveCheckOutDate.toISOString(),
          existingRate,
          available: false,
          conflict: {
            reservationNumber: conflictingReservation.reservationNumber,
            guestFirstName:    conflictingReservation.tenant.firstName,
            guestLastName:     conflictingReservation.tenant.lastName,
            fromDate:          conflictingReservation.startDate.toISOString(),
          },
          segments:          [] as { startDate: string; endDate: string; nights: number; ratePerNight: number; subtotal: number; priceName: string | null }[],
          extensionSubtotal: 0,
          extensionNights:   0,
        };
      }

      // ── Compute pricing for extension window ────────────────────────────────
      const extensionNights = calculateNights(effectiveCheckOutDate, newCheckOut);

      // Try fetching configured DB prices first
      const priceResult = await getUnitPriceForRange(unitId, effectiveCheckOutDate, newCheckOut);
      let segments: { startDate: string; endDate: string; nights: number; ratePerNight: number; subtotal: number; priceName: string | null }[];
      let extensionSubtotal: number;

      if (priceResult.totalAmount > 0) {
        // DB prices are configured — use them
        segments = collapseToSegments(priceResult.dailyBreakdown).map((s) => ({
          startDate: s.startDate, endDate: s.endDate,
          nights: s.nights, ratePerNight: s.ratePerNight,
          subtotal: s.subtotal, priceName: s.priceName,
        }));
        extensionSubtotal = roundOMR(priceResult.totalAmount);
      } else {
        // No DB prices — fall back to the reservation's existing rate
        extensionSubtotal = roundOMR(existingRate * extensionNights);
        const from = effectiveCheckOutDate.toISOString().slice(0, 10);
        const to   = new Date(newCheckOut.getTime() - 86400000).toISOString().slice(0, 10);
        segments = [{
          startDate: from, endDate: to,
          nights: extensionNights, ratePerNight: existingRate,
          subtotal: extensionSubtotal, priceName: null,
        }];
      }

      return {
        unitId, unitName, propertyName,
        effectiveCheckOut: effectiveCheckOutDate.toISOString(),
        existingRate,         // ← the rate currently on the reservation (used as UI default)
        available: true,
        conflict: undefined,
        segments,
        extensionSubtotal,
        extensionNights,
      };
    }),
  );

  const allAvailable  = unitResults.every((u) => u.available);
  const someAvailable = unitResults.some((u) => u.available);
  const extensionTotal = roundOMR(
    unitResults.filter((u) => u.available).reduce((s, u) => s + u.extensionSubtotal, 0),
  );

  const previousGrandTotal = roundOMR(Number(r.grandTotal));
  const previousAmountPaid = roundOMR(Number(r.amountPaid));
  const newGrandTotal      = roundOMR(previousGrandTotal + extensionTotal);
  const newBalanceDue      = roundOMR(newGrandTotal - previousAmountPaid);

  return NextResponse.json({
    reservationId: id,
    currentCheckOut: currentEndDate.toISOString(),
    newCheckOut:     newCheckOut.toISOString(),
    units:           unitResults,
    summary: {
      allAvailable, someAvailable,
      extensionTotal,
      previousGrandTotal, previousAmountPaid,
      newGrandTotal, newBalanceDue,
    },
  });
}
