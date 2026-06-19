import { prisma } from "@/lib/prisma";

export interface StatementRow {
  id: string;
  date: string;          // ISO
  type: string;
  description: string | null;
  reference: string | null;
  amount: number;        // signed
  balance: number;       // running balance after this row
}

export interface BankStatement {
  account: { id: string; bankName: string; label: string | null; accountNumber: string | null; currency: string };
  from: string;
  to: string;
  openingBalance: number;
  rows: StatementRow[];
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

/**
 * Build a bank statement for an account over [from, to] (inclusive). Opening
 * balance = account opening balance + every posted ledger row strictly before
 * `from`; the running balance is carried through the in-range rows.
 * Returns null if the account doesn't belong to the org.
 */
export async function getBankStatement(params: {
  orgId: string;
  bankAccountId: string;
  from: Date;
  to: Date;
}): Promise<BankStatement | null> {
  const { orgId, bankAccountId, from, to } = params;

  const account = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { id: true, organizationId: true, bankName: true, label: true, accountNumber: true, currency: true, openingBalance: true },
  });
  if (!account || account.organizationId !== orgId) return null;

  // Everything before `from` rolls into the opening balance.
  const priorAgg = await prisma.bankTransaction.aggregate({
    where: { bankAccountId, isVoid: false, date: { lt: from } },
    _sum: { amount: true },
  });
  const openingBalance = Number(account.openingBalance) + Number(priorAgg._sum.amount ?? 0);

  const txns = await prisma.bankTransaction.findMany({
    where: { bankAccountId, isVoid: false, date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, date: true, type: true, description: true, reference: true, amount: true },
  });

  let balance = openingBalance;
  let totalIn = 0;
  let totalOut = 0;
  const rows: StatementRow[] = txns.map((t) => {
    const amt = Number(t.amount);
    balance += amt;
    if (amt >= 0) totalIn += amt; else totalOut += amt;
    return {
      id: t.id,
      date: t.date.toISOString(),
      type: t.type,
      description: t.description,
      reference: t.reference,
      amount: amt,
      balance,
    };
  });

  return {
    account: {
      id: account.id,
      bankName: account.bankName,
      label: account.label,
      accountNumber: account.accountNumber,
      currency: account.currency,
    },
    from: from.toISOString(),
    to: to.toISOString(),
    openingBalance,
    rows,
    totalIn,
    totalOut: Math.abs(totalOut),
    closingBalance: balance,
  };
}
