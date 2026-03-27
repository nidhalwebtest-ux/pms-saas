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
  const fromUnitId    = searchParams.get("fromUnitId");
  const moveDateStr   = searchParams.get("moveDate");

  if (!reservationId || !fromUnitId || !moveDateStr) {
    return NextResponse.json(
      { error: "reservationId, fromUnitId, and moveDate are required" },
      { status: 400 },
    );
  }

  // NOTE: isMovedOut: { not: true } matches both false AND null (legacy records pre-schema-change)
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      tenant: { select: { organizationId: true } },
      reservationUnits: {
        where: { isMovedOut: { not: true } },
        select: { unitId: true },
      },
    },
  });

  if (!reservation || reservation.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Find the active RU for the unit being moved FROM
  const fromRU = await prisma.reservationUnit.findFirst({
    where: { reservationId, unitId: fromUnitId, isMovedOut: { not: true } },
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

  // All units already in this reservation — exclude from candidates
  // Include legacy unitId in addition to reservationUnits
  const occupiedUnitIds = new Set(reservation.reservationUnits.map((ru) => ru.unitId));
  if (reservation.unitId) occupiedUnitIds.add(reservation.unitId);
  // Always exclude the fromUnit itself
  occupiedUnitIds.add(fromUnitId);

  // Fetch all units in the org
  const allProperties = await prisma.property.findMany({
    where: { organizationId: actor.organizationId, isArchived: false },
    select: {
      id: true, name: true,
      units: {
        select: { id: true, name: true, floor: true, unitType: true, status: true },
      },
    },
  });

  type Candidate = { id: string; name: string; floor: number; unitType: string; propertyName: string; propertyId: string };
  const candidateUnits: Candidate[] = [];

  for (const property of allProperties) {
    for (const unit of property.units) {
      if (occupiedUnitIds.has(unit.id)) continue;
      candidateUnits.push({
        id: unit.id, name: unit.name, floor: unit.floor,
        unitType: unit.unitType, propertyName: property.name, propertyId: property.id,
      });
    }
  }

  const fromRateAmount = roundOMR(Number(fromRU.rateAmount));
  const availableUnits = [];

  for (const unit of candidateUnits) {
    // Check for conflicting reservations over [moveDate, periodEnd)
    const conflict = await prisma.reservation.findFirst({
      where: {
        id:     { not: reservationId },
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            unitId:    unit.id,
            startDate: { lt: periodEnd },
            endDate:   { gt: moveDate },
          },
          {
            reservationUnits: {
              some: { unitId: unit.id, isMovedOut: { not: true } },
            },
            startDate: { lt: periodEnd },
            endDate:   { gt: moveDate },
          },
        ],
      },
      select: { id: true },
    });

    if (conflict) continue;

    // Unit is available — compute pricing
    const priceResult = await getUnitPriceForRange(unit.id, moveDate, periodEnd);

    let rateAmount: number;
    let segments: { startDate: string; endDate: string; nights: number; ratePerNight: number; subtotal: number; priceName: string | null }[];
    let subtotal: number;

    if (priceResult.totalAmount > 0) {
      // DB prices configured for this unit
      const rawSegments = collapseToSegments(priceResult.dailyBreakdown);
      segments = rawSegments.map((s) => ({
        startDate: s.startDate, endDate: s.endDate,
        nights: s.nights, ratePerNight: s.ratePerNight,
        subtotal: s.subtotal, priceName: s.priceName,
      }));
      subtotal   = roundOMR(priceResult.totalAmount);
      rateAmount = remainingNights > 0 ? roundOMR(priceResult.totalAmount / remainingNights) : fromRateAmount;
    } else {
      // No DB prices — default to the FROM unit's existing rate so the comparison is meaningful
      rateAmount = fromRateAmount;
      subtotal   = roundOMR(fromRateAmount * remainingNights);
      const from = moveDate.toISOString().slice(0, 10);
      const to   = new Date(periodEnd.getTime() - 86400000).toISOString().slice(0, 10);
      segments = [{
        startDate: from, endDate: to,
        nights: remainingNights, ratePerNight: fromRateAmount,
        subtotal, priceName: null,
      }];
    }

    const rateDifference = roundOMR(rateAmount - fromRateAmount);
    const priceName      = segments[0]?.priceName ?? null;

    availableUnits.push({
      id: unit.id, name: unit.name, floor: unit.floor,
      unitType: unit.unitType, propertyName: unit.propertyName, propertyId: unit.propertyId,
      rateAmount, priceName, rateDifference, segments, subtotal,
    });
  }

  // Sort: same rate first, then upgrades, then downgrades
  availableUnits.sort((a, b) => Math.abs(a.rateDifference) - Math.abs(b.rateDifference));

  return NextResponse.json({
    remainingNights,
    periodEnd: periodEnd.toISOString(),
    fromUnit: {
      id:         fromRU.unitId,
      name:       fromRU.unit.name,
      rateAmount: fromRateAmount,
    },
    availableUnits,
  });
}
