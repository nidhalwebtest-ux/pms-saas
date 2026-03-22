import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

// GET /api/tenants/check-duplicate?idNumber=X&idType=Y
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });
  if (!dbUser?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idNumber = searchParams.get("idNumber")?.trim();
  const excludeId = searchParams.get("excludeId");

  if (!idNumber || idNumber.length < 2)
    return NextResponse.json({ exists: false });

  const tenant = await prisma.tenant.findFirst({
    where: {
      organizationId: dbUser.organizationId,
      idNumber,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!tenant) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists:   true,
    tenantId: tenant.id,
    name:     `${tenant.firstName} ${tenant.lastName}`,
  });
}
