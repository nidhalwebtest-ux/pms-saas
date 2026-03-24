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
  const { reason = "", notes = "" } = body as { reason?: string; notes?: string };

  if (!reason.trim())
    return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:           { select: { organizationId: true } },
      reservationUnits: { select: { unitId: true } },
      payments:         { select: { amount: true } },
    },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "CANCELLED"))
    return NextResponse.json(
      { error: `Cannot cancel a reservation with status "${res.status}".` },
      { status: 409 },
    );

  const cancelledReason = notes.trim()
    ? `${reason.trim()}: ${notes.trim()}`
    : reason.trim();

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
        status:          "CANCELLED",
        cancelledReason: cancelledReason,
        cancelledAt:     new Date(),
      },
    });
    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }
    await tx.reservationActivity.create({
      data: {
        reservationId: id,
        organizationId: actor.organizationId!,
        action: "CANCELLED",
        description: `Reservation cancelled. Reason: ${reason}${notes ? ` — ${notes}` : ""}`,
        performedById: actor.id,
        metadata: { reason, notes },
      },
    });
  });

  const totalPaid = res.payments.reduce((s, p) => s + Number(p.amount), 0);
  return NextResponse.json({
    success:   true,
    totalPaid: totalPaid.toFixed(3),
    message:   `Reservation ${res.id.slice(0, 8).toUpperCase()} cancelled.`,
  });
}
