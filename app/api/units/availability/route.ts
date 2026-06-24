/**
 * GET /api/units/availability?propertyId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&rateType=daily
 *
 * Returns availability + pricing for every unit in a property.
 * Used by the BookingEngine unit-selection step.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  calculateNights,
  countCalendarMonths,
  buildCalendarMonthBreakdown,
  collapseToSegments,
  sumSubtotals,
} from "@/lib/reservation-engine";
import { getUnitPriceForRange } from "@/lib/pricing";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const startStr   = searchParams.get("startDate");
  const endStr     = searchParams.get("endDate");
  const rateType   = (searchParams.get("rateType") ?? "daily") as "daily" | "monthly";
  // When editing a reservation, exclude it so its own units aren't shown as
  // occupied-by-themselves (QA #30).
  const excludeReservationId = searchParams.get("excludeReservationId");

  if (!propertyId || !startStr || !endStr)
    return NextResponse.json({ error: "propertyId, startDate, and endDate are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate)
    return NextResponse.json({ error: "Invalid dates." }, { status: 400 });

  // Verify property belongs to org
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!property || property.organizationId !== orgId)
    return NextResponse.json({ error: "Property not found." }, { status: 404 });

  // Fetch all bookable units for the property (inactive units are retired and
  // must not be selectable for new reservations).
  const units = await prisma.unit.findMany({
    where: { propertyId, isActive: true },
    include: {
      prices: {
        where:   { isActive: true },
        orderBy: { priority: "desc" },
      },
    },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  // Find conflicting reservations (both old and new style) for this date range
  const conflictingOld = await prisma.reservation.findMany({
    where: {
      unit:      { propertyId },
      status:    { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      startDate: { lt: endDate },
      endDate:   { gt: startDate },
      ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
    },
    select: {
      unitId: true,
      reservationNumber: true,
      startDate: true,
      endDate: true,
      tenant: { select: { firstName: true, lastName: true } },
    },
  });

  const conflictingNew = await prisma.reservationUnit.findMany({
    where: {
      unit:        { propertyId },
      reservation: {
        status:    { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
    select: {
      unitId: true,
      reservation: {
        select: {
          reservationNumber: true,
          startDate: true,
          endDate: true,
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  // Build a map: unitId → conflict info (first conflict found)
  type ConflictInfo = {
    reservationNumber: string | null;
    guestName: string;
    startDate: string;
    endDate: string;
  };
  const conflictMap = new Map<string, ConflictInfo>();

  for (const r of conflictingOld) {
    if (r.unitId && !conflictMap.has(r.unitId)) {
      conflictMap.set(r.unitId, {
        reservationNumber: r.reservationNumber,
        guestName: `${r.tenant.firstName} ${r.tenant.lastName}`,
        startDate: r.startDate.toISOString(),
        endDate:   r.endDate.toISOString(),
      });
    }
  }
  for (const ru of conflictingNew) {
    if (!conflictMap.has(ru.unitId)) {
      conflictMap.set(ru.unitId, {
        reservationNumber: ru.reservation.reservationNumber,
        guestName: `${ru.reservation.tenant.firstName} ${ru.reservation.tenant.lastName}`,
        startDate: ru.reservation.startDate.toISOString(),
        endDate:   ru.reservation.endDate.toISOString(),
      });
    }
  }

  const occupiedUnitIds = new Set(conflictMap.keys());

  const nights = calculateNights(startDate, endDate);

  // Build result for each unit
  const results = await Promise.all(
    units.map(async (unit) => {
      const available = !occupiedUnitIds.has(unit.id);

      let subtotal    = 0;
      let rateAmount  = 0;
      let rateSource  = "no_price";
      let priceName: string | null = null;
      let breakdown:  object[] = [];

      if (available) {
        if (rateType === "daily") {
          const priceResult = await getUnitPriceForRange(unit.id, startDate, endDate);
          const segments    = collapseToSegments(priceResult.dailyBreakdown);
          subtotal   = sumSubtotals(segments.map((s) => s.subtotal));
          rateAmount = segments[0]?.ratePerNight ?? 0;
          rateSource = segments[0]?.priceType === "SEASONAL" ? "seasonal_price" : "default_price";
          priceName  = segments[0]?.priceName ?? null;
          breakdown  = segments;
        } else {
          const defaultPrice = unit.prices.find((p) => p.priceType === "DEFAULT");
          const monthlyRate  = defaultPrice ? Number(defaultPrice.monthlyRate) : 0;
            const calMonths = countCalendarMonths(startDate, endDate);
          const segments  = buildCalendarMonthBreakdown(
            startDate, calMonths, monthlyRate, defaultPrice?.name ?? null, "DEFAULT",
          );
          subtotal   = sumSubtotals(segments.map((s) => s.subtotal));
          rateAmount = monthlyRate;
          rateSource = "default_price";
          priceName  = null;
          breakdown  = segments;
        }
      }

      return {
        id:          unit.id,
        name:        unit.name,
        unitType:    unit.unitType,
        floor:       unit.floor,
        bedrooms:    unit.bedrooms,
        bathrooms:   unit.bathrooms,
        area:        unit.area,
        amenities:   unit.amenities,
        status:      unit.status,
        available,
        conflict:    available ? null : (conflictMap.get(unit.id) ?? null),
        nights,
        rateType,
        rateAmount,
        rateSource,
        priceName,
        subtotal,
        breakdown,
      };
    }),
  );

  return NextResponse.json({ units: results, nights, startDate: startStr, endDate: endStr });
}
