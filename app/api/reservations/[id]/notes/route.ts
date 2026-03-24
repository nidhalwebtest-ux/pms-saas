import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
