import type { Prisma } from "@prisma/client";

/**
 * Bank ledger writer. Every bank-affecting event posts one signed
 * BankTransaction row (+ inflow, − outflow). The Bank Statement reads these
 * with a running balance; Phase 5 matching attaches to them.
 *
 * Pass a transaction client (`tx`) so the ledger row is written atomically with
 * its source (payment / expense / deposit).
 */
export type BankTxnType =
  | "PAYMENT_IN" | "REFUND_OUT" | "DEPOSIT_IN"
  | "EXPENSE_OUT" | "ADJUSTMENT" | "FEE";

const OUTFLOW = new Set<BankTxnType>(["REFUND_OUT", "EXPENSE_OUT", "FEE"]);

export interface LedgerInput {
  organizationId: string;
  bankAccountId:  string;
  type:           BankTxnType;
  amount:         number;            // positive magnitude; sign derived from type
  date:           Date;
  description?:   string | null;
  reference?:     string | null;
  paymentId?:     string | null;
  expenseId?:     string | null;
  createdById?:   string | null;
}

/** Post a signed ledger row. Outflow types are stored negative. */
export async function postBankTxn(tx: Prisma.TransactionClient, input: LedgerInput) {
  const magnitude = Math.abs(input.amount);
  const signed = OUTFLOW.has(input.type) ? -magnitude : magnitude;
  return tx.bankTransaction.create({
    data: {
      organizationId: input.organizationId,
      bankAccountId:  input.bankAccountId,
      type:           input.type,
      amount:         signed.toFixed(3),
      date:           input.date,
      description:    input.description ?? null,
      reference:      input.reference ?? null,
      paymentId:      input.paymentId ?? null,
      expenseId:      input.expenseId ?? null,
      createdById:    input.createdById ?? null,
    },
  });
}

/** Remove the ledger row sourced from a payment (e.g. on cancel/delete). */
export async function voidBankTxnForPayment(tx: Prisma.TransactionClient, paymentId: string) {
  await tx.bankTransaction.deleteMany({ where: { paymentId } });
}

/** Remove the ledger row sourced from an expense. */
export async function voidBankTxnForExpense(tx: Prisma.TransactionClient, expenseId: string) {
  await tx.bankTransaction.deleteMany({ where: { expenseId } });
}
