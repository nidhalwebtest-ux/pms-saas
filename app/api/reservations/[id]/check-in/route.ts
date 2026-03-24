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

  let body: { payment?: { amount: number; method: string; reference?: string; notes?: string } } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true } },
    },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "CHECKED_IN"))
    return NextResponse.json(
      { error: `Cannot check in a reservation with status "${res.status}".` },
      { status: 409 },
    );

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

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: { status: "CHECKED_IN", actualCheckIn: new Date() },
    });

    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "OCCUPIED" },
      });
    }

    // Optional payment at check-in
    if (body.payment && Number(body.payment.amount) > 0) {
      const payAmt = Number(body.payment.amount);
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
      await tx.reservation.update({
        where: { id },
        data: { amountPaid: { increment: payAmt } },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          organizationId: actor.organizationId!,
          action: "PAYMENT_RECORDED",
          description: `Payment of ${payAmt.toFixed(3)} OMR recorded at check-in (${body.payment.method})`,
          performedById: actor.id,
          metadata: { amount: payAmt, method: body.payment.method, atCheckIn: true },
        },
      });
    }

    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "CHECKED_IN",
        description: `Checked in${unitLabel ? ` — Units ${unitLabel} marked as Occupied` : ""}`,
        performedById: actor.id,
        metadata: { unitIds, unitNames: unitNames.map((u) => u.name) },
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: `${res.tenant.firstName} ${res.tenant.lastName} checked in${unitLabel ? ` to ${unitLabel}` : ""}.`,
  });
}
