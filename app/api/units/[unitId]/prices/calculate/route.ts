import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgId } from "@/lib/current-user";
import { getUnitPriceForRange } from "@/lib/pricing";

// GET /api/units/[unitId]/prices/calculate?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const { unitId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "startDate and endDate query params are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });

  if (startDate >= endDate)
    return NextResponse.json({ error: "startDate must be before endDate." }, { status: 400 });

  const result = await getUnitPriceForRange(unitId, startDate, endDate);
  return NextResponse.json(result);
}
