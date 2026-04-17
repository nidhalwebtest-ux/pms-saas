import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/expenses/bulk-approve — approve multiple pending expenses at once.
 */
export async function POST(req: NextRequest) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  if (!["OWNER", "MANAGER"].includes(orgUser.role ?? "")) {
    return NextResponse.json({ error: "Only managers can approve expenses" }, { status: 403 });
  }

  const body = await req.json();
  const { expenseIds } = body;

  if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
    return NextResponse.json({ error: "No expenses selected" }, { status: 400 });
  }

  // Verify all belong to org and are pending
  const expenses = await prisma.expense.findMany({
    where: {
      id: { in: expenseIds },
      organizationId: orgUser.organizationId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (expenses.length === 0) {
    return NextResponse.json({ error: "No valid pending expenses found" }, { status: 400 });
  }

  const validIds = expenses.map((e) => e.id);

  await prisma.expense.updateMany({
    where: { id: { in: validIds } },
    data: {
      status: "APPROVED",
      reviewedById: orgUser.userId,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    approvedCount: validIds.length,
    skippedCount: expenseIds.length - validIds.length,
  });
}
