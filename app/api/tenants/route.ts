import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

// GET /api/tenants?q=&classification=&tenantType=&source=&page=1
export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q              = searchParams.get("q")?.trim() || "";
  const classification = searchParams.get("classification") || "";
  const tenantType     = searchParams.get("tenantType") || "";
  const source         = searchParams.get("source") || "";

  const tenants = await prisma.tenant.findMany({
    where: {
      organizationId: orgId,
      ...(q && {
        OR: [
          { firstName:  { contains: q, mode: "insensitive" } },
          { lastName:   { contains: q, mode: "insensitive" } },
          { phone:      { contains: q, mode: "insensitive" } },
          { idNumber:   { contains: q, mode: "insensitive" } },
          { email:      { contains: q, mode: "insensitive" } },
          { nationality: { contains: q, mode: "insensitive" } },
        ],
      }),
      ...(classification && { classification }),
      ...(tenantType     && { tenantType }),
      ...(source         && { source }),
    },
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      nationality: true, idType: true, idNumber: true, tenantType: true,
      source: true, classification: true, totalStays: true, isActive: true,
      createdAt: true, tags: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ tenants });
}

// POST /api/tenants
export async function POST(req: NextRequest) {
  const denied = await forbiddenIfNo("tenants", "CREATE");
  if (denied) return denied;
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { firstName, lastName, phone, idNumber, idType, nationality, tenantType, source } = body;

  if (!firstName || !lastName || !phone || !idNumber || !nationality || !tenantType || !source)
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

  const dup = await prisma.tenant.findFirst({
    where: { organizationId: orgId, idNumber },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ error: "ID number already exists." }, { status: 409 });

  const tenant = await prisma.tenant.create({
    data: { ...body, nationalId: idNumber, organizationId: orgId },
  });

  return NextResponse.json({ tenant }, { status: 201 });
}
