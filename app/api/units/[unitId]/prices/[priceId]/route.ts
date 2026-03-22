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

async function assertPriceOrg(priceId: string, orgId: string) {
  const price = await prisma.unitPrice.findUnique({
    where:   { id: priceId },
    include: { unit: { include: { property: { select: { organizationId: true } } } } },
  });
  return price?.unit.property.organizationId === orgId ? price : null;
}

// PUT /api/units/[unitId]/prices/[priceId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string; priceId: string }> },
) {
  const { priceId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const price = await assertPriceOrg(priceId, orgId);
  if (!price) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { dailyRate, weeklyRate, monthlyRate, name, startDate, endDate, priority, isActive } = body;

  if (!dailyRate || !monthlyRate)
    return NextResponse.json({ error: "dailyRate and monthlyRate are required." }, { status: 400 });

  const data: any = {
    dailyRate,
    weeklyRate: weeklyRate ?? null,
    monthlyRate,
  };

  if (price.priceType === "SEASONAL") {
    if (!name) return NextResponse.json({ error: "Name is required for seasonal prices." }, { status: 400 });
    if (!startDate || !endDate)
      return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });
    if (new Date(startDate) >= new Date(endDate))
      return NextResponse.json({ error: "startDate must be before endDate." }, { status: 400 });

    Object.assign(data, {
      name,
      startDate: new Date(startDate),
      endDate:   new Date(endDate),
      priority:  priority ?? 10,
      isActive:  isActive  ?? true,
    });
  }

  const updated = await prisma.unitPrice.update({ where: { id: priceId }, data });
  return NextResponse.json({ price: updated });
}

// DELETE /api/units/[unitId]/prices/[priceId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string; priceId: string }> },
) {
  const { priceId } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const price = await assertPriceOrg(priceId, orgId);
  if (!price) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (price.priceType === "DEFAULT")
    return NextResponse.json({ error: "Cannot delete the default price." }, { status: 400 });

  await prisma.unitPrice.delete({ where: { id: priceId } });
  return NextResponse.json({ success: true });
}
