import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
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

type PricingOption = "charge_difference" | "complimentary" | "apply_new_rate" | "keep_original_rate";

interface MoveUnitBody {
  fromUnitId: string;
  toUnitId: string;
  moveDate: string;
  reason: string;
  notes?: string;
  pricingOption: PricingOption;
  /** User-entered custom rate for the new unit (overrides DB price and fromUnit rate) */
  customRate?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: MoveUnitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fromUnitId, toUnitId, moveDate: moveDateStr, reason, notes, pricingOption, customRate } = body;

  if (!fromUnitId || !toUnitId || !moveDateStr || !reason || !pricingOption) {
    return NextResponse.json(
      { error: "fromUnitId, toUnitId, moveDate, reason, and pricingOption are required" },
      { status: 400 },
    );
  }

  // Load reservation
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: {
        // isMovedOut: { not: true } matches both false AND null (legacy records)
        where: { isMovedOut: { not: true } },
      },
    },
  });

  if (!r || r.tenant.organizationId !== actor.organizationId) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (r.status !== "CHECKED_IN") {
    return NextResponse.json(
      { error: "Unit moves are only allowed for checked-in reservations" },
      { status: 409 },
    );
  }

  // Find the active ReservationUnit for fromUnitId
  const fromRU = r.reservationUnits.find((ru) => ru.unitId === fromUnitId);
  if (!fromRU) {
    return NextResponse.json({ error: "From unit not found in this reservation" }, { status: 404 });
  }

  const moveDate = new Date(moveDateStr);
  moveDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reservationEnd = new Date(r.endDate);
  reservationEnd.setHours(0, 0, 0, 0);

  // Validate: moveDate >= today and moveDate < reservation.endDate
  if (moveDate < today) {
    return NextResponse.json({ error: "Move date cannot be in the past" }, { status: 400 });
  }
  if (moveDate >= reservationEnd) {
    return NextResponse.json(
      { error: "Move date must be before the reservation end date" },
      { status: 400 },
    );
  }

  // periodEnd for the remaining stay
  const periodEnd = fromRU.effectiveCheckOut
    ? new Date(fromRU.effectiveCheckOut)
    : new Date(r.endDate);
  periodEnd.setHours(0, 0, 0, 0);

  // Re-check toUnit availability from moveDate to periodEnd
  const conflict = await prisma.reservation.findFirst({
    where: {
      id: { not: id },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      OR: [
        {
          unitId: toUnitId,
          startDate: { lt: periodEnd },
          endDate: { gt: moveDate },
        },
        {
          reservationUnits: {
            some: {
              unitId: toUnitId,
              isMovedOut: { not: true },
            },
          },
          startDate: { lt: periodEnd },
          endDate: { gt: moveDate },
        },
      ],
    },
  });

  if (conflict) {
    return NextResponse.json(
      { error: "The destination unit is not available for the requested period" },
      { status: 409 },
    );
  }

  const remainingNights = calculateNights(moveDate, periodEnd);
  const fromRateAmount = roundOMR(Number(fromRU.rateAmount));
  const isMonthlyReservation = fromRU.rateType === "monthly" || fromRU.rateType === "MONTHLY";
  const remainingMonths = isMonthlyReservation ? Math.max(1, countCalendarMonths(moveDate, periodEnd)) : 0;

  // Compute new unit pricing outside TX for performance.
  // Monthly reservations bill in months (not days), so toRatePerNight here
  // actually means "rate for the same billing unit as fromRU" — for monthly
  // that's a per-month figure, fallback to the existing monthly rate.
  const toUnitPricing = await getUnitPriceForRange(toUnitId, moveDate, periodEnd);
  const toRatePerNight = isMonthlyReservation
    ? fromRateAmount
    : (toUnitPricing.nights > 0
        ? roundOMR(toUnitPricing.totalAmount / toUnitPricing.nights)
        : fromRateAmount);

  // Calculate old unit revised subtotal (from its effectiveCheckIn to moveDate)
  const fromEffectiveCheckIn = fromRU.effectiveCheckIn
    ? new Date(fromRU.effectiveCheckIn)
    : new Date(r.startDate);
  fromEffectiveCheckIn.setHours(0, 0, 0, 0);

  const oldUnitRevised = await getUnitPriceForRange(fromUnitId, fromEffectiveCheckIn, moveDate);
  const monthsStayedOnOld = isMonthlyReservation
    ? countCalendarMonths(fromEffectiveCheckIn, moveDate)
    : 0;
  const oldUnitRevisedSubtotal = isMonthlyReservation
    ? roundOMR(fromRateAmount * monthsStayedOnOld)
    : roundOMR(oldUnitRevised.totalAmount);

  // Determine new unit's rate and subtotal based on pricingOption
  let selectedRateAmount: number;
  let newUnitSubtotal: number;
  let rateSource: string;

  // Monthly reservations bill the new unit at monthlyRate × remainingMonths;
  // daily ones at toUnitPricing.totalAmount or rate × remainingNights.
  const periodCount = isMonthlyReservation ? remainingMonths : remainingNights;
  const monthlyMarketSubtotal = roundOMR(toRatePerNight * periodCount);

  switch (pricingOption) {
    case "apply_new_rate":
      selectedRateAmount = toRatePerNight;
      newUnitSubtotal = isMonthlyReservation ? monthlyMarketSubtotal : roundOMR(toUnitPricing.totalAmount);
      rateSource = "default_price";
      break;
    case "charge_difference":
      selectedRateAmount = toRatePerNight;
      newUnitSubtotal = isMonthlyReservation ? monthlyMarketSubtotal : roundOMR(toUnitPricing.totalAmount);
      rateSource = "default_price";
      break;
    case "complimentary":
      selectedRateAmount = fromRateAmount;
      newUnitSubtotal = roundOMR(fromRateAmount * periodCount);
      rateSource = "manual_override";
      break;
    case "keep_original_rate":
      selectedRateAmount = fromRateAmount;
      newUnitSubtotal = roundOMR(fromRateAmount * periodCount);
      rateSource = "manual_override";
      break;
    default:
      selectedRateAmount = toRatePerNight;
      newUnitSubtotal = isMonthlyReservation ? monthlyMarketSubtotal : roundOMR(toUnitPricing.totalAmount);
      rateSource = "default_price";
  }

  // customRate overrides everything when provided. For monthly it's a monthly
  // rate; for daily it's a nightly rate.
  if (customRate !== undefined && customRate > 0) {
    selectedRateAmount = roundOMR(customRate);
    newUnitSubtotal = roundOMR(customRate * periodCount);
    rateSource = "manual_override";
  }

  // Get toUnit name for activity log
  const toUnit = await prisma.unit.findUnique({
    where: { id: toUnitId },
    select: { id: true, name: true },
  });
  if (!toUnit) {
    return NextResponse.json({ error: "Destination unit not found" }, { status: 404 });
  }

  const fromUnit = await prisma.unit.findUnique({
    where: { id: fromUnitId },
    select: { id: true, name: true },
  });
  if (!fromUnit) {
    return NextResponse.json({ error: "Source unit not found" }, { status: 404 });
  }

  // Determine if this is a move happening today (affects unit status updates)
  const isToday = moveDate.getTime() === today.getTime();

  let newGrandTotal = 0;

  await prisma.$transaction(
    async (tx) => {
      const moveReason = reason + (notes ? ` — ${notes}` : "");

      // a. Mark old RU as moved out. For monthly the `nights` column carries
      // the months stayed on the old unit; the RU.subtotal is monthlyRate ×
      // monthsStayed and was computed above.
      await tx.reservationUnit.update({
        where: { id: fromRU.id },
        data: {
          isMovedOut: true,
          effectiveCheckOut: moveDate,
          moveReason,
          moveDate,
          nights: isMonthlyReservation ? Math.max(1, monthsStayedOnOld) : oldUnitRevised.nights,
          subtotal: oldUnitRevisedSubtotal,
        },
      });

      // b. Create new RU for the destination unit
      const newRU = await tx.reservationUnit.create({
        data: {
          reservationId: id,
          unitId: toUnitId,
          rateType: fromRU.rateType,
          rateAmount: selectedRateAmount,
          rateSource,
          nights: isMonthlyReservation ? remainingMonths : remainingNights,
          subtotal: newUnitSubtotal,
          effectiveCheckIn: moveDate,
        },
      });

      // c. Set movedToUnitId on old RU
      await tx.reservationUnit.update({
        where: { id: fromRU.id },
        data: { movedToUnitId: newRU.id },
      });

      // d. Recalculate reservation totals
      // Sum all non-moved-out RU subtotals (which now includes the updated old RU and new RU)
      const allRUs = await tx.reservationUnit.findMany({
        where: { reservationId: id },
        select: { subtotal: true, isMovedOut: true },
      });

      // Include all RUs (moved-out ones contribute their partial stay costs)
      const newTotalAmount = roundOMR(
        allRUs.reduce((s, ru) => s + Number(ru.subtotal), 0),
      );
      const discountAmount = roundOMR(Number(r.discountAmount));
      newGrandTotal = roundOMR(newTotalAmount - discountAmount);
      const totalNights = calculateNights(new Date(r.startDate), new Date(r.endDate));

      await tx.reservation.update({
        where: { id },
        data: {
          totalAmount: newTotalAmount,
          grandTotal: newGrandTotal,
          totalNights,
        },
      });

      // e. Flip unit statuses for any move whose effective date is today or
      // earlier. Future-dated moves still wait — but a backdated or same-day
      // move needs to free the old unit and occupy the new one immediately.
      // Also clear the legacy reservation.unitId pointer if it still points
      // at the unit being moved out so the units list and unit-detail pages
      // (which derive their badge from `unit.reservations`) attribute the
      // active stay to the new unit instead of the old one.
      if (moveDate.getTime() <= today.getTime()) {
        await tx.unit.update({
          where: { id: fromUnitId },
          data: { status: "AVAILABLE" },
        });
        await tx.unit.update({
          where: { id: toUnitId },
          data: { status: "OCCUPIED" },
        });
        if (r.unitId === fromUnitId) {
          await tx.reservation.update({
            where: { id },
            data:  { unitId: toUnitId },
          });
        }
      }

      // f. Create activity log
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          organizationId: actor.organizationId!,
          action: "UNIT_MOVED",
          description: `Guest moved from Unit ${fromUnit.name} to Unit ${toUnit.name} on ${moveDate.toISOString().slice(0, 10)}. Reason: ${reason}. Pricing: ${pricingOption.replace(/_/g, " ")}.`,
          performedById: actor.id,
          metadata: {
            fromUnitId,
            fromUnitName: fromUnit.name,
            toUnitId,
            toUnitName: toUnit.name,
            moveDate: moveDate.toISOString(),
            reason,
            notes: notes ?? null,
            pricingOption,
            newGrandTotal,
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return NextResponse.json({
    success: true,
    fromUnit: fromUnit.name,
    toUnit: toUnit.name,
    moveDate: moveDate.toISOString(),
    newGrandTotal,
  });
}
