/**
 * GET /api/units/[unitId]/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Checks availability for a single unit.
 * Returns { available: boolean, conflict?: { id, startDate, endDate, status } }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const { unitId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify unit belongs to org
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get("startDate");
  const endStr   = searchParams.get("endDate");

  if (!startStr || !endStr)
    return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate)
    return NextResponse.json({ error: "Invalid dates." }, { status: 400 });

  // Check old-style (Reservation.unitId)
  const conflictOld = await prisma.reservation.findFirst({
    where: {
      unitId,
      status:    { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      startDate: { lt: endDate },
      endDate:   { gt: startDate },
    },
    select: { id: true, startDate: true, endDate: true, status: true },
  });

  if (conflictOld) {
    return NextResponse.json({
      available: false,
      conflict: {
        id:        conflictOld.id,
        startDate: conflictOld.startDate.toISOString().slice(0, 10),
        endDate:   conflictOld.endDate.toISOString().slice(0, 10),
        status:    conflictOld.status,
      },
    });
  }

  // Check new-style (ReservationUnit)
  const conflictNew = await prisma.reservationUnit.findFirst({
    where: {
      unitId,
      reservation: {
        status:    { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
      },
    },
    include: {
      reservation: { select: { id: true, startDate: true, endDate: true, status: true } },
    },
  });

  if (conflictNew) {
    return NextResponse.json({
      available: false,
      conflict: {
        id:        conflictNew.reservation.id,
        startDate: conflictNew.reservation.startDate.toISOString().slice(0, 10),
        endDate:   conflictNew.reservation.endDate.toISOString().slice(0, 10),
        status:    conflictNew.reservation.status,
      },
    });
  }

  return NextResponse.json({ available: true });
}
