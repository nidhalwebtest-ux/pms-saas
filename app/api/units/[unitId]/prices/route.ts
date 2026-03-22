import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { organizationId: true } });
  return dbUser?.organizationId ?? null;
}

// GET /api/units/[unitId]/prices
export async function GET(req: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prices = await prisma.unitPrice.findMany({
    where:   { unitId },
    orderBy: [{ priceType: "asc" }, { startDate: "asc" }],
  });

  return NextResponse.json({ prices });
}

// POST /api/units/[unitId]/prices
export async function POST(req: NextRequest, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { priceType, name, dailyRate, weeklyRate, monthlyRate, startDate, endDate, priority, isActive } = body;

  if (!priceType || !dailyRate || !monthlyRate)
    return NextResponse.json({ error: "priceType, dailyRate, and monthlyRate are required." }, { status: 400 });

  if (priceType === "DEFAULT") {
    const existing = await prisma.unitPrice.findFirst({ where: { unitId, priceType: "DEFAULT" } });
    if (existing) return NextResponse.json({ error: "Default price already exists." }, { status: 409 });
  }

  if (priceType === "SEASONAL") {
    if (!name)       return NextResponse.json({ error: "Name is required for seasonal prices." }, { status: 400 });
    if (!startDate || !endDate) return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });
    if (new Date(startDate) >= new Date(endDate))
      return NextResponse.json({ error: "startDate must be before endDate." }, { status: 400 });
  }

  const price = await prisma.unitPrice.create({
    data: {
      unitId, priceType, name: name ?? null,
      dailyRate, weeklyRate: weeklyRate ?? null, monthlyRate,
      startDate: startDate ? new Date(startDate) : null,
      endDate:   endDate   ? new Date(endDate)   : null,
      priority:  priority ?? 10,
      isActive:  isActive  ?? true,
    },
  });

  return NextResponse.json({ price }, { status: 201 });
}
