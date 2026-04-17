import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/expenses/[id]/approve — approve a pending expense.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  if (!["OWNER", "MANAGER"].includes(orgUser.role ?? "")) {
    return NextResponse.json({ error: "Only managers can approve expenses" }, { status: 403 });
  }

  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending expenses can be approved" }, { status: 400 });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedById: orgUser.userId,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, expense: { ...updated, amount: Number(updated.amount) } });
}
