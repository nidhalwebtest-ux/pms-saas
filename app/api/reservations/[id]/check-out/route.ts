import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canTransitionTo, type StoredStatus } from "@/lib/reservation-status";
import { calculateNights, roundOMR } from "@/lib/reservation-engine";
import { getUnitPriceForRange } from "@/lib/pricing";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: {
    forceWithBalance?: boolean;
    adjustCharges?: boolean;
    additionalAmount?: number;
    payment?: { amount: number; method: string; reference?: string; notes?: string };
    unitCondition?: { inspected?: boolean; keysReturned?: boolean; noDamage?: boolean };
  } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true, rateType: true, rateAmount: true, rateSource: true } },
    },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "COMPLETED"))
    return NextResponse.json(
      { error: `Cannot check out a reservation with status "${res.status}".` },
      { status: 409 },
    );

  const grandTotal = Number(res.grandTotal ?? res.totalPrice ?? 0);
  const amountPaid = Number(res.amountPaid ?? 0);
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  // Balance check — return info if balance exists and not forced
  if (balanceDue > 0 && !body.forceWithBalance && !body.payment) {
    return NextResponse.json(
      { requiresAction: "balance", balanceDue: balanceDue.toFixed(3), grandTotal: grandTotal.toFixed(3) },
      { status: 200 },
    );
  }

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  const unitNames = await prisma.unit.findMany({
    where:  { id: { in: unitIds } },
    select: { name: true },
  });
  const unitLabel = unitNames.map((u) => u.name).join(", ");

  const now = new Date();

  // Calculate adjustment amount
  let adjustmentAmount = 0;
  let adjustmentDescription = "";

  if (body.adjustCharges) {
    const actualNights  = calculateNights(res.startDate, now);
    const plannedNights = res.totalNights;

    if (actualNights < plannedNights) {
      // Early checkout — reduction
      const reduction = body.additionalAmount ?? 0;
      adjustmentAmount = -Math.abs(reduction);
      adjustmentDescription = `Early checkout: ${actualNights} of ${plannedNights} nights — reduction of ${Math.abs(adjustmentAmount).toFixed(3)} OMR`;
    }
    // Overstay charges removed — checkout never adds an overstay/late fee.
  }

  const newGrandTotal = roundOMR(grandTotal + adjustmentAmount);
  const payAmt        = body.payment ? Number(body.payment.amount) : 0;
  const newAmountPaid = amountPaid + payAmt;
  const finalBalance  = Math.max(0, newGrandTotal - newAmountPaid);

  await prisma.$transaction(async (tx) => {
    // Update reservation
    await tx.reservation.update({
      where: { id },
      data: {
        status:         "COMPLETED",
        actualCheckOut: now,
        ...(adjustmentAmount !== 0 ? {
          grandTotal: newGrandTotal,
          totalPrice: newGrandTotal,
        } : {}),
        ...(payAmt > 0 ? { amountPaid: newAmountPaid } : {}),
      },
    });

    // Free units
    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }

    // Payment
    if (payAmt > 0 && body.payment) {
      await tx.payment.create({
        data: {
          amount: payAmt,
          method: body.payment.method as any,
          reference: body.payment.reference ?? null,
          notes: body.payment.notes ?? null,
          tenantId: res.tenantId,
          reservationId: id,
        },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          organizationId: actor.organizationId!,
          action: "PAYMENT_RECORDED",
          description: `Payment of ${payAmt.toFixed(3)} OMR recorded at checkout (${body.payment.method})`,
          performedById: actor.id,
          metadata: { amount: payAmt, method: body.payment.method, atCheckOut: true },
        },
      });
    }

    // Adjustment log
    if (adjustmentAmount !== 0) {
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          organizationId: actor.organizationId!,
          action: "CHARGE_ADDED",
          description: adjustmentDescription,
          performedById: actor.id,
          metadata: { adjustmentAmount, newGrandTotal },
        },
      });
    }

    // Check-out log
    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "CHECKED_OUT",
        description: `Checked out${unitLabel ? ` — Units ${unitLabel} marked as Available` : ""}. Final balance: ${finalBalance.toFixed(3)} OMR`,
        performedById: actor.id,
        metadata: {
          unitIds,
          unitCondition: body.unitCondition ?? null,
          finalBalance,
          adjustmentAmount,
        },
      },
    });
  });

  return NextResponse.json({
    success:      true,
    message:      `${res.tenant.firstName} ${res.tenant.lastName} checked out${unitLabel ? ` from ${unitLabel}` : ""}. Final balance: ${finalBalance.toFixed(3)} OMR`,
    finalBalance: finalBalance.toFixed(3),
  });
}
