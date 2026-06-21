import { prisma } from "@/lib/prisma";

/**
 * Daily cash daybook (cash book) for one building.
 *
 * Convention: Debit = money INTO the drawer (increases the running balance),
 * Credit = money OUT (decreases it). Running balance = opening + Σ(debit − credit).
 *
 * Cash movements (the building's CASH drawer ledger) affect the balance.
 * Non-cash collections (card/transfer/cheque/online for the same building that
 * day) are listed too — with equal debit AND credit so they're visible but have
 * zero effect on the cash balance (option B). The closing balance is what the
 * cashier compares against the physically counted cash.
 */

export interface DaybookRow {
  id: string;
  time: string;          // ISO timestamp
  kind: "CASH" | "NONCASH";
  type: string;          // ledger type (cash) or payment method (non-cash)
  method: string | null; // payment method label key
  description: string | null;
  reference: string | null;
  isRefund: boolean;
  debit: number;         // money in
  credit: number;        // money out
  balance: number;       // running cash balance after this row
}

export interface CashierDaybook {
  property: { id: string; name: string } | null;
  drawerId: string | null;
  hasDrawer: boolean;
  date: string;          // ISO start-of-day
  openingBalance: number;
  rows: DaybookRow[];
  cashIn: number;        // Σ debit (cash)
  cashOut: number;       // Σ credit (cash)
  nonCashTotal: number;  // Σ non-cash collections (net of non-cash refunds)
  closingBalance: number;
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getCashierDaybook(params: {
  orgId: string;
  propertyId: string;
  date: Date;
}): Promise<CashierDaybook> {
  const { orgId, propertyId, date } = params;
  const { start, end } = dayBounds(date);

  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: orgId },
    select: { id: true, name: true },
  });

  // The building's cash drawer (may not exist yet).
  const drawer = await prisma.bankAccount.findFirst({
    where: { organizationId: orgId, type: "CASH", propertyId },
    select: { id: true, openingBalance: true },
  });

  // Opening balance = float + every posted drawer row strictly before today.
  let openingBalance = 0;
  let cashTxns: { id: string; date: Date; type: string; description: string | null; reference: string | null; amount: unknown }[] = [];
  if (drawer) {
    const prior = await prisma.bankTransaction.aggregate({
      where: { bankAccountId: drawer.id, isVoid: false, date: { lt: start } },
      _sum: { amount: true },
    });
    openingBalance = Number(drawer.openingBalance) + Number(prior._sum.amount ?? 0);

    cashTxns = await prisma.bankTransaction.findMany({
      where: { bankAccountId: drawer.id, isVoid: false, date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, date: true, type: true, description: true, reference: true, amount: true },
    });
  }

  // Non-cash collections for this building, this day (informational, net-zero).
  // Map a payment to its building via its reservation OR its (allocated/legacy)
  // invoice — payments are often recorded against invoices with no direct
  // reservation link, so reservation-only matching misses them.
  const nonCash = await prisma.payment.findMany({
    where: {
      organizationId: orgId,
      date: { gte: start, lte: end },
      method: { not: "CASH" },
      OR: [
        { reservation: { unit: { propertyId } } },
        { reservation: { reservationUnits: { some: { unit: { propertyId } } } } },
        { invoice: { propertyId } },
        { invoice: { reservation: { unit: { propertyId } } } },
        { allocations: { some: { invoice: { propertyId } } } },
        { allocations: { some: { invoice: { reservation: { unit: { propertyId } } } } } },
      ],
    },
    select: {
      id: true, date: true, method: true, reference: true, isRefund: true,
      amount: true, paymentNumber: true,
    },
  });

  // Build rows.
  const cashRows: DaybookRow[] = cashTxns.map((t) => {
    const amt = Number(t.amount); // signed: + in, − out
    return {
      id: t.id,
      time: t.date.toISOString(),
      kind: "CASH" as const,
      type: t.type,
      method: t.type === "PAYMENT_IN" ? "CASH" : null,
      description: t.description,
      reference: t.reference,
      isRefund: t.type === "REFUND_OUT",
      debit: amt > 0 ? amt : 0,
      credit: amt < 0 ? -amt : 0,
      balance: 0, // filled after merge/sort
    };
  });

  const nonCashRows: DaybookRow[] = nonCash.map((p) => {
    const amt = Number(p.amount);
    return {
      id: p.id,
      time: p.date.toISOString(),
      kind: "NONCASH" as const,
      type: p.method,
      method: p.method,
      description: p.paymentNumber ? `Payment ${p.paymentNumber}` : null,
      reference: p.reference,
      isRefund: p.isRefund,
      debit: amt,   // shown on both sides → zero net effect on cash
      credit: amt,
      balance: 0,
    };
  });

  // Merge chronologically; running balance reflects cash rows only (non-cash net 0).
  const rows = [...cashRows, ...nonCashRows].sort((a, b) => a.time.localeCompare(b.time));
  let balance = openingBalance;
  let cashIn = 0, cashOut = 0;
  for (const r of rows) {
    if (r.kind === "CASH") {
      balance += r.debit - r.credit;
      cashIn += r.debit;
      cashOut += r.credit;
    }
    r.balance = balance;
  }

  const nonCashTotal = nonCash.reduce(
    (s, p) => s + (p.isRefund ? -1 : 1) * Number(p.amount),
    0,
  );

  return {
    property: property ?? null,
    drawerId: drawer?.id ?? null,
    hasDrawer: !!drawer,
    date: start.toISOString(),
    openingBalance,
    rows,
    cashIn,
    cashOut,
    nonCashTotal,
    closingBalance: balance,
  };
}
