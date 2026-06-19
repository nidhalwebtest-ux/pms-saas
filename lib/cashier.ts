import { prisma } from "@/lib/prisma";

export interface CashierSummary {
  date: string;                          // ISO day
  byMethod: Record<string, number>;      // net per method (in − refunds)
  expectedCash: number;                  // cash in − cash refunds = drawer
  totalCollected: number;                // net across all methods
  byCashier: { userId: string; name: string; cash: number; total: number }[];
  paymentCount: number;
}

const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "ONLINE", "OTHER"];

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Summarise a day's payments for the cashier reconciliation: net totals per
 * method, the expected drawer cash (cash in − cash refunds), and a per-cashier
 * breakdown. Org-scoped by `date`.
 */
export async function getCashierSummary(params: {
  orgId: string;
  date: Date;
}): Promise<CashierSummary> {
  const { orgId, date } = params;
  const { start, end } = dayBounds(date);

  const payments = await prisma.payment.findMany({
    where: { organizationId: orgId, date: { gte: start, lte: end } },
    select: {
      amount: true, method: true, isRefund: true,
      receivedById: true,
      receivedBy: { select: { firstName: true, lastName: true } },
    },
  });

  const byMethod: Record<string, number> = Object.fromEntries(METHODS.map((m) => [m, 0]));
  const cashierMap = new Map<string, { userId: string; name: string; cash: number; total: number }>();

  for (const p of payments) {
    const signed = (p.isRefund ? -1 : 1) * Number(p.amount);
    const m = METHODS.includes(p.method) ? p.method : "OTHER";
    byMethod[m] += signed;

    const uid = p.receivedById ?? "—";
    const name = p.receivedBy ? `${p.receivedBy.firstName ?? ""} ${p.receivedBy.lastName ?? ""}`.trim() || "—" : "—";
    const row = cashierMap.get(uid) ?? { userId: uid, name, cash: 0, total: 0 };
    if (m === "CASH") row.cash += signed;
    row.total += signed;
    cashierMap.set(uid, row);
  }

  const expectedCash = byMethod.CASH;
  const totalCollected = METHODS.reduce((s, m) => s + byMethod[m], 0);

  return {
    date: start.toISOString(),
    byMethod,
    expectedCash,
    totalCollected,
    byCashier: [...cashierMap.values()].sort((a, b) => b.total - a.total),
    paymentCount: payments.length,
  };
}
