import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canTransitionTo, type StoredStatus } from "@/lib/reservation-status";

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
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    forceWithBalance = false,
    adjustCharges    = false,
    additionalAmount = 0,
  } = body as { forceWithBalance?: boolean; adjustCharges?: boolean; additionalAmount?: number };

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:          { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true } },
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

  // If balance outstanding and client hasn't explicitly forced checkout, ask for confirmation
  if (balanceDue > 0 && !forceWithBalance) {
    return NextResponse.json(
      {
        requiresConfirmation: true,
        type:       "balance",
        balanceDue: balanceDue.toFixed(3),
        message:    `Outstanding balance: ${balanceDue.toFixed(3)} OMR. Check out anyway?`,
      },
      { status: 200 },
    );
  }

  // Adjust total if requested
  let newGrandTotal = grandTotal;

  if (adjustCharges) {
    // Early checkout — recalculate proportionally to actual nights
    const checkInDate   = res.actualCheckIn ?? res.startDate;
    const plannedNights = Math.max(1, res.totalNights);
    const actualNights  = Math.max(
      1,
      Math.ceil((new Date().getTime() - new Date(checkInDate).getTime()) / 86_400_000),
    );
    newGrandTotal = Math.round((grandTotal * actualNights / plannedNights) * 1000) / 1000;
  } else if (Number(additionalAmount) > 0) {
    // Overstay — add extra charges
    newGrandTotal = Math.round((grandTotal + Number(additionalAmount)) * 1000) / 1000;
  }

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: {
        status:         "COMPLETED",
        actualCheckOut: new Date(),
        ...(newGrandTotal !== grandTotal
          ? { grandTotal: newGrandTotal, totalAmount: newGrandTotal, totalPrice: newGrandTotal, amount: newGrandTotal }
          : {}),
      },
    });
    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }
  });

  const finalBalance = Math.max(0, newGrandTotal - amountPaid).toFixed(3);
  return NextResponse.json({
    success:      true,
    finalBalance,
    message: `${res.tenant.firstName} ${res.tenant.lastName} checked out. Final balance: ${finalBalance} OMR`,
  });
}
