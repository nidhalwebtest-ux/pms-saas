import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUnitPriceForRange } from "@/lib/pricing";
import { collapseToSegments, calculateNights, roundOMR } from "@/lib/reservation-engine";

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

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const reservationId = searchParams.get("reservationId");
  const fromUnitId = searchParams.get("fromUnitId");
  const moveDateStr = searchParams.get("moveDate");

  if (!reservationId || !fromUnitId || !moveDateStr) {
    return NextResponse.json(
      { error: "reservationId, fromUnitId, and moveDate are required" },
      { status: 400 },
    );
  }

  // Load reservation with org validation
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      reservationUnits: {
        where: { isMovedOut: false },
        select: { unitId: true },
      },
    },
  });

  if (!reservation || reservation.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Load the current ReservationUnit for fromUnitId
  const fromRU = await prisma.reservationUnit.findFirst({
    where: { reservationId, unitId: fromUnitId, isMovedOut: false },
    include: { unit: { select: { id: true, name: true } } },
  });

  if (!fromRU) {
    return NextResponse.json({ error: "Unit not found in this reservation" }, { status: 404 });
  }

  const moveDate = new Date(moveDateStr);
  moveDate.setHours(0, 0, 0, 0);

  const periodEnd = fromRU.effectiveCheckOut
    ? new Date(fromRU.effectiveCheckOut)
    : new Date(reservation.endDate);
  periodEnd.setHours(0, 0, 0, 0);

  const remainingNights = calculateNights(moveDate, periodEnd);

  // Collect unit IDs already in this reservation (exclude from candidates)
  const occupiedUnitIds = new Set(reservation.reservationUnits.map((ru) => ru.unitId));

  // Find all units belonging to this org's properties
  const allProperties = await prisma.property.findMany({
    where: { organizationId: actor.organizationId },
    select: {
      id: true,
      name: true,
      units: {
        select: {
          id: true,
          name: true,
          floor: true,
          unitType: true,
          status: true,
        },
      },
    },
  });

  // Flatten units, exclude units already in reservation and the fromUnit
  const candidateUnits: Array<{
    id: string; name: string; floor: number; unitType: string;
    propertyName: string; propertyId: string;
  }> = [];

  for (const property of allProperties) {
    for (const unit of property.units) {
      if (occupiedUnitIds.has(unit.id)) continue;
      if (unit.id === fromUnitId) continue;
      candidateUnits.push({
        id: unit.id,
        name: unit.name,
        floor: unit.floor,
        unitType: unit.unitType,
        propertyName: property.name,
        propertyId: property.id,
      });
    }
  }

  // Check availability for each candidate and compute pricing
  const availableUnits = [];

  for (const unit of candidateUnits) {
    // Check for conflicts in [moveDate, periodEnd)
    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: reservationId },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            unitId: unit.id,
            startDate: { lt: periodEnd },
            endDate: { gt: moveDate },
          },
          {
            reservationUnits: {
              some: {
                unitId: unit.id,
                isMovedOut: false,
              },
            },
            startDate: { lt: periodEnd },
            endDate: { gt: moveDate },
          },
        ],
      },
    });

    if (conflict) continue;

    // Unit is available — compute pricing
    const priceResult = await getUnitPriceForRange(unit.id, moveDate, periodEnd);
    const segments = collapseToSegments(priceResult.dailyBreakdown).map((s) => ({
      startDate: s.startDate,
      endDate: s.endDate,
      nights: s.nights,
      ratePerNight: s.ratePerNight,
      subtotal: s.subtotal,
      priceName: s.priceName,
    }));
    const subtotal = roundOMR(priceResult.totalAmount);

    // Daily rate from first segment (or total / nights)
    const rateAmount = priceResult.nights > 0
      ? roundOMR(priceResult.totalAmount / priceResult.nights)
      : Number(fromRU.rateAmount);

    const firstSegment = segments[0];
    const rateSource = firstSegment ? "default_price" : "default_price";
    const priceName = firstSegment?.priceName ?? null;

    const fromRateAmount = roundOMR(Number(fromRU.rateAmount));
    const rateDifference = roundOMR(rateAmount - fromRateAmount);

    availableUnits.push({
      id: unit.id,
      name: unit.name,
      floor: unit.floor,
      unitType: unit.unitType,
      propertyName: unit.propertyName,
      propertyId: unit.propertyId,
      rateAmount,
      rateSource,
      priceName,
      rateDifference,
      segments,
      subtotal,
    });
  }

  return NextResponse.json({
    remainingNights,
    periodEnd: periodEnd.toISOString(),
    fromUnit: {
      id: fromRU.unitId,
      name: fromRU.unit.name,
      rateAmount: roundOMR(Number(fromRU.rateAmount)),
    },
    availableUnits,
  });
}
