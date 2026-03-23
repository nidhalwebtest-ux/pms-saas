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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant:          { select: { organizationId: true, firstName: true, lastName: true } },
      reservationUnits: { select: { unitId: true } },
    },
  });

  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  if (!canTransitionTo(res.status as StoredStatus, "NO_SHOW"))
    return NextResponse.json(
      { error: `Cannot mark as No Show: current status is "${res.status}".` },
      { status: 409 },
    );

  // No Show is only valid if check-in date is in the past
  const todayMidnight  = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const checkInMidnight = new Date(res.startDate); checkInMidnight.setHours(0, 0, 0, 0);
  if (checkInMidnight >= todayMidnight)
    return NextResponse.json(
      { error: "Cannot mark as No Show before the check-in date." },
      { status: 409 },
    );

  const unitIds = [
    ...new Set([
      ...(res.unitId ? [res.unitId] : []),
      ...res.reservationUnits.map((ru) => ru.unitId),
    ]),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data:  { status: "NO_SHOW" },
    });
    if (unitIds.length > 0) {
      await tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data:  { status: "AVAILABLE" },
      });
    }
  });

  return NextResponse.json({
    success: true,
    message: `${res.tenant.firstName} ${res.tenant.lastName} marked as No Show.`,
  });
}
