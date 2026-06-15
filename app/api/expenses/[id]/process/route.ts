import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/expenses/[id]/process — accountant processes an approved expense.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("expenses", "EDIT");
  if (__denied) return __denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  if (!["OWNER", "ACCOUNTANT"].includes(orgUser.role ?? "")) {
    return NextResponse.json({ error: "Only accountants can process expenses" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { paymentMethod, bankReference, processingNotes } = body;

  if (!paymentMethod) {
    return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
  }

  const validMethods = ["petty_cash", "bank_transfer", "already_paid"];
  if (!validMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  if (paymentMethod === "bank_transfer" && !bankReference?.trim()) {
    return NextResponse.json({ error: "Bank reference is required for bank transfers" }, { status: 400 });
  }

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved expenses can be processed" }, { status: 400 });
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: "PROCESSED",
      processedById: orgUser.userId,
      processedAt: new Date(),
      paymentMethod,
      bankReference: bankReference?.trim() || null,
      processingNotes: processingNotes?.trim() || null,
    },
  });

  return NextResponse.json({ success: true, expense: { ...updated, amount: Number(updated.amount) } });
}
