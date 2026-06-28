import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { postBankTxn } from "@/lib/bank-ledger";
import { getOrCreateCashDrawer } from "@/lib/cash-drawer";

/**
 * PATCH /api/expenses/[id]/process — accountant processes an approved expense.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("expenseProcess", "VIEW");
  if (__denied) return __denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const body = await req.json();
  const { paymentMethod, bankReference, processingNotes, bankAccountId } = body;

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

  // Bank transfers must name the account they're paid from (drives the bank
  // statement outflow). Validate org ownership.
  let resolvedBankId: string | null = null;
  if (paymentMethod === "bank_transfer") {
    if (!bankAccountId) {
      return NextResponse.json({ error: "A bank account is required for bank transfers" }, { status: 400 });
    }
    const bank = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { organizationId: true },
    });
    if (!bank || bank.organizationId !== orgUser.organizationId) {
      return NextResponse.json({ error: "Invalid bank account" }, { status: 400 });
    }
    resolvedBankId = bankAccountId;
  }

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
  if (expense.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved expenses can be processed" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedById: orgUser.userId,
        processedAt: now,
        paymentMethod,
        bankReference: bankReference?.trim() || null,
        processingNotes: processingNotes?.trim() || null,
        bankAccountId: resolvedBankId,
      },
    });

    // Ledger outflow: bank-transfer expense leaves its bank account; petty-cash
    // expense leaves the building's cash drawer (auto-created if needed).
    if (resolvedBankId) {
      await postBankTxn(tx, {
        organizationId: orgUser.organizationId,
        bankAccountId:  resolvedBankId,
        type:           "EXPENSE_OUT",
        amount:         Number(exp.amount),
        date:           now,
        description:    `Expense ${exp.expenseNumber}`,
        reference:      bankReference?.trim() || null,
        expenseId:      exp.id,
        createdById:    orgUser.userId,
      });
    } else if (paymentMethod === "petty_cash") {
      const drawer = await getOrCreateCashDrawer(tx, orgUser.organizationId, exp.propertyId);
      if (drawer) {
        await postBankTxn(tx, {
          organizationId: orgUser.organizationId,
          bankAccountId:  drawer.id,
          type:           "EXPENSE_OUT",
          amount:         Number(exp.amount),
          date:           now,
          description:    `Petty cash — Expense ${exp.expenseNumber}`,
          reference:      bankReference?.trim() || null,
          expenseId:      exp.id,
          createdById:    orgUser.userId,
        });
      }
    }
    return exp;
  });

  return NextResponse.json({ success: true, expense: { ...updated, amount: Number(updated.amount) } });
}
