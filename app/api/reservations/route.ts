import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  calculateNights,
  countCalendarMonths,
  buildCalendarMonthBreakdown,
  collapseToSegments,
  calculateGrandTotal,
  roundOMR,
  sumSubtotals,
} from "@/lib/reservation-engine";
import { getUnitPriceForRange } from "@/lib/pricing";

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── Reservation number generator ──────────────────────────────────────────────

async function generateReservationNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.reservation.count();
  return `RES-${year}-${String(count + 1).padStart(5, "0")}`;
}

// ── Availability check (re-used inside transaction) ───────────────────────────

async function isUnitAvailable(
  tx:        Prisma.TransactionClient,
  unitId:    string,
  startDate: Date,
  endDate:   Date,
  excludeReservationId?: string,
): Promise<boolean> {
  // Check old-style reservations (Reservation.unitId)
  const conflictOld = await tx.reservation.findFirst({
    where: {
      unitId,
      status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
      startDate: { lt: endDate },
      endDate:   { gt: startDate },
    },
    select: { id: true },
  });
  if (conflictOld) return false;

  // Check new-style reservations (ReservationUnit)
  const conflictNew = await tx.reservationUnit.findFirst({
    where: {
      unitId,
      reservation: {
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
      },
    },
    select: { id: true },
  });
  return !conflictNew;
}

// ── POST /api/reservations ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    tenantId,
    unitIds,           // string[]  — at least one unit
    startDate: startStr,
    endDate:   endStr,
    rateType,          // "daily" | "monthly"
    source,
    notes,
    discountAmount: discountRaw = 0,
    // Custom rate overrides: [{unitId, rateAmount}]
    unitOverrides = [] as { unitId: string; rateAmount: number }[],
  } = body;

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0)
    return NextResponse.json({ error: "tenantId and at least one unitId are required." }, { status: 400 });

  if (!startStr || !endStr)
    return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });

  if (startDate >= endDate)
    return NextResponse.json({ error: "checkOut must be after checkIn." }, { status: 400 });

  const rt: "daily" | "monthly" = rateType === "monthly" ? "monthly" : "daily";

  // ── Verify tenant belongs to org ──────────────────────────────────────────

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  // ── Verify units belong to org and compute pricing ─────────────────────────

  const unitRecords = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    include: { property: { select: { organizationId: true } } },
  });

  if (unitRecords.length !== unitIds.length)
    return NextResponse.json({ error: "One or more units not found." }, { status: 404 });

  for (const u of unitRecords) {
    if (u.property.organizationId !== actor.organizationId)
      return NextResponse.json({ error: "Unauthorized access to unit." }, { status: 403 });
  }

  // Compute pricing per unit (outside transaction — read-only, safe to do first)
  type UnitPricing = {
    unitId:            string;
    rateType:          string;
    rateAmount:        number;
    rateSource:        string;
    seasonalPriceName: string | null;
    nights:            number;
    subtotal:          number;
  };

  const totalNightsVal = calculateNights(startDate, endDate);
  const calMonths      = countCalendarMonths(startDate, endDate);
  const unitPricings: UnitPricing[] = [];

  for (const unitId of unitIds) {
    // Check for manual override from the booking UI
    const override = (unitOverrides as { unitId: string; rateAmount: number }[])
      .find((o) => o.unitId === unitId);

    if (rt === "daily") {
      if (override && override.rateAmount > 0) {
        // Custom daily rate
        unitPricings.push({
          unitId,
          rateType:          "daily",
          rateAmount:        override.rateAmount,
          rateSource:        "manual_override",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal:          roundOMR(override.rateAmount * totalNightsVal),
        });
      } else {
        const priceResult = await getUnitPriceForRange(unitId, startDate, endDate);
        const segments    = collapseToSegments(priceResult.dailyBreakdown);
        const subtotal    = sumSubtotals(segments.map((s) => s.subtotal));
        const firstSeg    = segments[0];
        unitPricings.push({
          unitId,
          rateType:          "daily",
          rateAmount:        firstSeg?.ratePerNight ?? 0,
          rateSource:        firstSeg?.priceType === "SEASONAL" ? "seasonal_price" : "default_price",
          seasonalPriceName: firstSeg?.priceName ?? null,
          nights:            totalNightsVal,
          subtotal,
        });
      }
    } else {
      // Monthly — calendar month standard
      if (override && override.rateAmount > 0) {
        // Custom monthly rate
        unitPricings.push({
          unitId,
          rateType:          "monthly",
          rateAmount:        override.rateAmount,
          rateSource:        "manual_override",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal:          roundOMR(override.rateAmount * calMonths),
        });
      } else {
        const prices       = await prisma.unitPrice.findMany({ where: { unitId, isActive: true } });
        const defaultPrice = prices.find((p) => p.priceType === "DEFAULT");
        const monthlyRate  = defaultPrice ? Number(defaultPrice.monthlyRate) : 0;
        const segments     = buildCalendarMonthBreakdown(
          startDate, calMonths, monthlyRate, defaultPrice?.name ?? null, "DEFAULT",
        );
        unitPricings.push({
          unitId,
          rateType:          "monthly",
          rateAmount:        monthlyRate,
          rateSource:        "default_price",
          seasonalPriceName: null,
          nights:            totalNightsVal,
          subtotal:          sumSubtotals(segments.map((s) => s.subtotal)),
        });
      }
    }
  }

  const discount    = Math.max(0, Number(discountRaw) || 0);
  const grandResult = calculateGrandTotal(
    unitPricings.map((u) => u.subtotal),
    discount,
  );

  const totalNights = totalNightsVal;

  // ── Serializable transaction (double-booking prevention) ──────────────────

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        // Re-check availability inside the transaction
        for (const unitId of unitIds) {
          const available = await isUnitAvailable(tx, unitId, startDate, endDate);
          if (!available) {
            throw new Error(`CONFLICT:${unitId}`);
          }
        }

        const resNumber = await generateReservationNumber();

        const res = await tx.reservation.create({
          data: {
            reservationNumber: resNumber,
            startDate,
            endDate,
            status:         "PENDING",
            rateType:       rt,
            source:         source ?? "walk_in",
            notes:          notes ?? null,
            frequency:      rt === "monthly" ? "MONTHLY" : "DAILY",
            totalNights,
            amount:         grandResult.grandTotal,  // compat
            totalPrice:     grandResult.grandTotal,  // compat
            totalAmount:    grandResult.totalAmount,
            discountAmount: grandResult.discountAmount,
            taxAmount:      grandResult.taxAmount,
            grandTotal:     grandResult.grandTotal,
            amountPaid:     0,
            tenantId,
            // unitId stays null for multi-unit; set for single-unit for compat
            unitId: unitIds.length === 1 ? unitIds[0] : null,
            createdById: actor.id,
          },
        });

        // Create ReservationUnit rows
        await tx.reservationUnit.createMany({
          data: unitPricings.map((up) => ({
            reservationId:     res.id,
            unitId:            up.unitId,
            rateType:          up.rateType,
            rateAmount:        up.rateAmount,
            rateSource:        up.rateSource,
            seasonalPriceName: up.seasonalPriceName,
            nights:            up.nights,
            subtotal:          up.subtotal,
          })),
        });

        return res;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("CONFLICT:")) {
      const conflictUnitId = msg.replace("CONFLICT:", "");
      const unit = unitRecords.find((u) => u.id === conflictUnitId);
      return NextResponse.json(
        { error: `Unit "${unit?.name ?? conflictUnitId}" is no longer available for the selected dates.` },
        { status: 409 },
      );
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
