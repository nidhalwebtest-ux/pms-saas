import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

const SEED_CATEGORIES = [
  { name: "Cleaning",                nameAr: "تنظيف",              icon: "🧹", sortOrder: 1 },
  { name: "Maintenance & Repairs",   nameAr: "صيانة وإصلاحات",     icon: "🔧", sortOrder: 2 },
  { name: "Office Supplies",         nameAr: "مستلزمات مكتبية",    icon: "📦", sortOrder: 3 },
  { name: "Utilities",               nameAr: "خدمات (ماء/كهرباء)", icon: "💡", sortOrder: 4 },
  { name: "Transportation",          nameAr: "مواصلات",            icon: "🚗", sortOrder: 5 },
  { name: "Food & Beverages",        nameAr: "أغذية ومشروبات",     icon: "🍔", sortOrder: 6 },
  { name: "Miscellaneous",           nameAr: "متفرقات",            icon: "📋", sortOrder: 7 },
];

/**
 * GET /api/expense-categories — list active categories for the org.
 * Auto-seeds predefined categories on first call if none exist.
 */
export async function GET() {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // Auto-seed if the org has no categories yet
  const count = await prisma.expenseCat.count({ where: { organizationId: orgUser.organizationId } });
  if (count === 0) {
    await prisma.expenseCat.createMany({
      data: SEED_CATEGORIES.map((c) => ({
        ...c,
        organizationId: orgUser.organizationId,
        isSystem: true,
      })),
    });
  }

  const categories = await prisma.expenseCat.findMany({
    where: { organizationId: orgUser.organizationId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ success: true, categories });
}

/**
 * POST /api/expense-categories — create a custom category.
 */
export async function POST(req: NextRequest) {
  const denied = await forbiddenIfNo("expenseCategories", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const body = await req.json();
  const { name, nameAr, icon } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  // Get max sortOrder
  const last = await prisma.expenseCat.findFirst({
    where: { organizationId: orgUser.organizationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const cat = await prisma.expenseCat.create({
    data: {
      organizationId: orgUser.organizationId,
      name: name.trim(),
      nameAr: nameAr?.trim() || null,
      icon: icon?.trim() || null,
      isSystem: false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ success: true, category: cat });
}
