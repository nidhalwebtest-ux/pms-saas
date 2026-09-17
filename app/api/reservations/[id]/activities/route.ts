import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/current-user";

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
