import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/current-user";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim())
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: { tenant: { select: { organizationId: true } } },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  await prisma.reservationActivity.create({
    data: {
      reservationId: id,
      organizationId: actor.organizationId!,
      action: "NOTE_ADDED",
      description: content.trim(),
      performedById: actor.id,
    },
  });

  return NextResponse.json({ success: true });
}
