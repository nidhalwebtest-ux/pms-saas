import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/expenses/[id]/reject — reject a pending expense.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("expenses", "EDIT");
  if (__denied) return __denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  if (!["OWNER", "MANAGER"].includes(orgUser.role ?? "")) {
    return NextResponse.json({ error: "Only managers can reject expenses" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { reason, notes } = body;

  if (!reason?.trim()) {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  }

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending expenses can be rejected" }, { status: 400 });
  }

  const rejectionReason = reason === "Other" && notes?.trim()
    ? `Other: ${notes.trim()}`
    : reason.trim();

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: orgUser.userId,
      reviewedAt: new Date(),
      rejectionReason,
    },
  });

  return NextResponse.json({ success: true, expense: { ...updated, amount: Number(updated.amount) } });
}
