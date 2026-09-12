import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

/**
 * GET /api/vendors — list active vendors for the org (used by the expense
 * form's vendor selector). VIEW-level access is enough here — STAFF can
 * pick an existing vendor on an expense without being able to manage the
 * vendor list itself (see lib/rbac.ts DEFAULT_MATRICES).
 */
export async function GET() {
  const denied = await forbiddenIfNo("vendors", "VIEW");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const vendors = await prisma.vendor.findMany({
    where: { organizationId: orgUser.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, nameAr: true, categoryId: true },
  });

  return NextResponse.json({ success: true, vendors });
}

/**
 * POST /api/vendors — quick-create a vendor (the expense form's inline
 * "create new vendor" flow, so a receptionist isn't blocked mid-submission).
 */
export async function POST(req: NextRequest) {
  const denied = await forbiddenIfNo("vendors", "CREATE");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const body = await req.json();
  const name = (body.name as string | undefined)?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Vendor name must be at least 2 characters" }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: { organizationId: orgUser.organizationId, name },
  });

  return NextResponse.json({ success: true, vendor });
}
