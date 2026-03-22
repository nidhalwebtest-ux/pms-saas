import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

// GET /api/tenants/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reservations: {
        include: { unit: { include: { property: { select: { name: true } } } } },
        orderBy: { startDate: "desc" },
        take: 10,
      },
    },
  });

  if (!tenant || tenant.organizationId !== orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ tenant });
}

// PUT /api/tenants/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.tenant.findUnique({
    where: { id }, select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== orgId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Duplicate idNumber check (exclude self)
  if (body.idNumber) {
    const dup = await prisma.tenant.findFirst({
      where: { organizationId: orgId, idNumber: body.idNumber, NOT: { id } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ error: "ID number already in use." }, { status: 409 });
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data:  { ...body, nationalId: body.idNumber ?? undefined },
  });

  return NextResponse.json({ tenant });
}
