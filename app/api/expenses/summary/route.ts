import { NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/expenses/summary — dashboard summary stats.
 */
export async function GET() {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const where = { organizationId: orgUser.organizationId };

  const [byStatus, byCategory, byProperty] = await Promise.all([
    prisma.expense.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { ...where, status: { not: "REJECTED" } },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["propertyId"],
      where: { ...where, status: { not: "REJECTED" } },
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  // Enrich category names
  const catIds = byCategory.map((c) => c.categoryId);
  const cats = catIds.length
    ? await prisma.expenseCat.findMany({
        where: { id: { in: catIds } },
        select: { id: true, name: true, icon: true },
      })
    : [];
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

  // Enrich property names
  const propIds = byProperty.map((p) => p.propertyId);
  const props = propIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propIds } },
        select: { id: true, name: true },
      })
    : [];
  const propMap = Object.fromEntries(props.map((p) => [p.id, p]));

  const statusSummary: Record<string, { count: number; total: number }> = {};
  for (const s of byStatus) {
    statusSummary[s.status] = {
      count: s._count.id,
      total: Math.round(Number(s._sum.amount ?? 0) * 1000) / 1000,
    };
  }

  return NextResponse.json({
    success: true,
    byStatus: statusSummary,
    byCategory: byCategory.map((c) => ({
      categoryId: c.categoryId,
      name: catMap[c.categoryId]?.name ?? "Unknown",
      icon: catMap[c.categoryId]?.icon ?? "",
      count: c._count.id,
      total: Math.round(Number(c._sum.amount ?? 0) * 1000) / 1000,
    })),
    byProperty: byProperty.map((p) => ({
      propertyId: p.propertyId,
      name: propMap[p.propertyId]?.name ?? "Unknown",
      count: p._count.id,
      total: Math.round(Number(p._sum.amount ?? 0) * 1000) / 1000,
    })),
  });
}
