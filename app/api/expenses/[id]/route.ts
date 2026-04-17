import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/expenses/[id] — expense detail with full workflow info.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      property: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      processedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  // STAFF can only see own expenses
  if (orgUser.role === "STAFF" && expense.submittedById !== orgUser.userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    expense: { ...expense, amount: Number(expense.amount) },
  });
}

/**
 * PUT /api/expenses/[id] — edit a pending expense (submitter only).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending expenses can be edited" }, { status: 400 });
  }
  if (expense.submittedById !== orgUser.userId) {
    return NextResponse.json({ error: "You can only edit your own expenses" }, { status: 403 });
  }

  const body = await req.json();

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(body.categoryId && { categoryId: body.categoryId }),
      ...(body.description && { description: body.description.trim() }),
      ...(body.amount && { amount: Math.round(Number(body.amount) * 1000) / 1000 }),
      ...(body.propertyId && { propertyId: body.propertyId }),
      ...(body.receiptImage && { receiptImage: body.receiptImage }),
      ...(body.receiptImage2 !== undefined && { receiptImage2: body.receiptImage2 || null }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
    },
  });

  return NextResponse.json({ success: true, expense: { ...updated, amount: Number(updated.amount) } });
}

/**
 * DELETE /api/expenses/[id] — delete a pending expense (submitter only).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending expenses can be deleted" }, { status: 400 });
  }
  if (expense.submittedById !== orgUser.userId && orgUser.role !== "OWNER") {
    return NextResponse.json({ error: "You can only delete your own expenses" }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
