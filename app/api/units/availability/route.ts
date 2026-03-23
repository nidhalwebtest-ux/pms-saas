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
  calculateMonths,
  buildMonthlyBreakdown,
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

  // Fetch all units for the property
  const units = await prisma.unit.findMany({
    where: { propertyId },
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
    },
    select: { unitId: true },
  });

  const conflictingNew = await prisma.reservationUnit.findMany({
    where: {
      unit:        { propertyId },
      reservation: {
        status:    { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
      },
    },
    select: { unitId: true },
  });

  const occupiedUnitIds = new Set([
    ...conflictingOld.map((r) => r.unitId).filter(Boolean) as string[],
    ...conflictingNew.map((r) => r.unitId),
  ]);

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
          const { fullMonths, remainingDays } = calculateMonths(startDate, endDate);
          const segments = buildMonthlyBreakdown(
            monthlyRate, defaultPrice?.name ?? null, "DEFAULT",
            fullMonths, remainingDays, startDate,
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
