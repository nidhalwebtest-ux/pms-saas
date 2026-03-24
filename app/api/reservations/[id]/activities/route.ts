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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: { tenant: { select: { organizationId: true } } },
  });
  if (!res || res.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const activities = await prisma.reservationActivity.findMany({
    where: { reservationId: id },
    orderBy: { createdAt: "desc" },
    include: { performedBy: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      performedByName: a.performedBy
        ? `${a.performedBy.firstName ?? ""} ${a.performedBy.lastName ?? ""}`.trim()
        : null,
      createdAt: a.createdAt.toISOString(),
      metadata: a.metadata,
    })),
  });
}
