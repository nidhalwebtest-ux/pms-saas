import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

/**
 * PUT /api/expense-categories/[id] — edit a custom category.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await forbiddenIfNo("expenseCategories", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const cat = await prisma.expenseCat.findUnique({ where: { id } });
  if (!cat || cat.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (cat.isSystem) {
    return NextResponse.json({ error: "System categories cannot be renamed" }, { status: 400 });
  }

  const body = await req.json();
  const updated = await prisma.expenseCat.update({
    where: { id },
    data: {
      name: body.name?.trim() || cat.name,
      nameAr: body.nameAr?.trim() ?? cat.nameAr,
      icon: body.icon?.trim() ?? cat.icon,
    },
  });

  return NextResponse.json({ success: true, category: updated });
}

/**
 * PATCH /api/expense-categories/[id] — toggle active/inactive.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await forbiddenIfNo("expenseCategories", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const cat = await prisma.expenseCat.findUnique({ where: { id } });
  if (!cat || cat.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const updated = await prisma.expenseCat.update({
    where: { id },
    data: { isActive: !cat.isActive },
  });

  return NextResponse.json({ success: true, category: updated });
}
