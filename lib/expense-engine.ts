import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* ============================================================================
 *  Expense creation — shared core used by POST /api/expenses (the manual
 *  "Submit Expense" form) and the CSV/Excel import adapter
 *  (lib/import/adapters/expenses.ts), same write path so imported expenses
 *  behave identically to ones submitted via the UI. Mirrors
 *  createPropertyCore's role for Buildings.
 * ========================================================================= */

function roundOMR(n: number): number {
  return Math.round(n * 1000) / 1000;
}

async function nextExpenseNumber(orgId: string, tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `EXP-${year}-`;

  const last = await tx.expense.findFirst({
    where: { organizationId: orgId, expenseNumber: { startsWith: prefix } },
    orderBy: { expenseNumber: "desc" },
    select: { expenseNumber: true },
  });

  let seq = 1;
  if (last?.expenseNumber) {
    const parts = last.expenseNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

export interface CreateExpenseInput {
  categoryId: string;
  propertyId: string;
  description: string;
  amount: number;
  vendorId?: string | null;
  receiptImage?: string | null;
  receiptImage2?: string | null;
  notes?: string | null;
  /** Defaults to now() — the import adapter passes the CSV's own date when
   *  one is mapped, so a historical migration keeps its real submission date
   *  instead of everything landing on "today". */
  submittedAt?: Date;
}

/**
 * Creates an expense with a fresh sequential number, in a transaction (same
 * as the manual submit route). Does NOT re-validate that categoryId/
 * propertyId/vendorId belong to the organization or that the category/vendor
 * are active — callers must do that first (both the API route and the
 * import adapter's validateRow already do, each against their own inputs),
 * since this core has no request/session context to check against.
 */
export async function createExpenseCore(
  input: CreateExpenseInput,
  organizationId: string,
  submittedById: string,
): Promise<{ id: string }> {
  const expense = await prisma.$transaction(async (tx) => {
    const expenseNumber = await nextExpenseNumber(organizationId, tx);

    return tx.expense.create({
      data: {
        organizationId,
        expenseNumber,
        categoryId: input.categoryId,
        vendorId: input.vendorId || null,
        description: input.description.trim(),
        amount: roundOMR(input.amount),
        propertyId: input.propertyId,
        receiptImage: input.receiptImage || null,
        receiptImage2: input.receiptImage2 || null,
        notes: input.notes?.trim() || null,
        submittedById,
        submittedAt: input.submittedAt ?? new Date(),
        status: "PENDING",
      },
      select: { id: true },
    });
  });

  return { id: expense.id };
}
