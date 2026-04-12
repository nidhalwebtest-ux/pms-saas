import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

function roundOMR(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id: tenantId } = await params;
  const sp = new URL(req.url).searchParams;
  const dateFrom      = sp.get("dateFrom")      ?? "";
  const dateTo        = sp.get("dateTo")        ?? "";
  const typeFilter    = sp.get("type")          ?? "all"; // all/invoices/payments/returns
  const reservationId = sp.get("reservationId") ?? "";

  // Verify tenant belongs to org
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true, firstName: true, lastName: true },
  });
  if (!tenant || tenant.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Build date filter for invoices
  const invoiceDateFilter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    invoiceDateFilter.issueDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  // Build date filter for payments
  const paymentDateFilter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    paymentDateFilter.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  const reservationFilter = reservationId ? { reservationId } : {};

  // 1. Fetch non-cancelled invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      organizationId: orgUser.organizationId,
      status: { notIn: ["CANCELLED", "VOID"] },
      ...invoiceDateFilter,
      ...reservationFilter,
    },
    select: {
      id: true,
      invoiceNumber: true,
      periodStart: true,
      periodEnd: true,
      totalAmount: true,
      issueDate: true,
      status: true,
      reservationId: true,
      monthNumber: true,
    },
    orderBy: { issueDate: "asc" },
  });

  // 2. Fetch non-refund payments
  const payments = await prisma.payment.findMany({
    where: {
      tenantId,
      organizationId: orgUser.organizationId,
      isRefund: false,
      ...paymentDateFilter,
      ...reservationFilter,
    },
    select: {
      id: true,
      paymentNumber: true,
      amount: true,
      date: true,
      method: true,
      reservationId: true,
    },
    orderBy: { date: "asc" },
  });

  // 3. Fetch refund payments
  const refunds = await prisma.payment.findMany({
    where: {
      tenantId,
      organizationId: orgUser.organizationId,
      isRefund: true,
      ...paymentDateFilter,
      ...reservationFilter,
    },
    select: {
      id: true,
      paymentNumber: true,
      amount: true,
      date: true,
      method: true,
      reservationId: true,
    },
    orderBy: { date: "asc" },
  });

  // 4. Build transaction array
  type LedgerEntry = {
    id: string;
    date: string;
    type: "invoice" | "payment" | "return";
    description: string;
    debit: number;
    credit: number;
    referenceId: string;
    referenceNumber: string;
    reservationId: string | null;
    runningBalance?: number;
  };

  const transactions: LedgerEntry[] = [];

  for (const inv of invoices) {
    const periodDesc =
      inv.periodStart && inv.periodEnd
        ? ` (${new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`
        : "";
    const monthLabel = inv.monthNumber ? ` — Month ${inv.monthNumber}` : "";
    transactions.push({
      id: `inv-${inv.id}`,
      date: inv.issueDate.toISOString(),
      type: "invoice",
      description: `${inv.invoiceNumber}${monthLabel}${periodDesc}`,
      debit: roundOMR(Number(inv.totalAmount)),
      credit: 0,
      referenceId: inv.id,
      referenceNumber: inv.invoiceNumber,
      reservationId: inv.reservationId ?? null,
    });
  }

  for (const pay of payments) {
    const num = pay.paymentNumber ?? pay.id.slice(0, 8).toUpperCase();
    transactions.push({
      id: `pay-${pay.id}`,
      date: pay.date.toISOString(),
      type: "payment",
      description: `Payment ${num} — ${pay.method.charAt(0) + pay.method.slice(1).toLowerCase().replace("_", " ")}`,
      debit: 0,
      credit: roundOMR(Number(pay.amount)),
      referenceId: pay.id,
      referenceNumber: num,
      reservationId: pay.reservationId ?? null,
    });
  }

  for (const ref of refunds) {
    const num = ref.paymentNumber ?? ref.id.slice(0, 8).toUpperCase();
    transactions.push({
      id: `ret-${ref.id}`,
      date: ref.date.toISOString(),
      type: "return",
      description: `Refund ${num}`,
      debit: roundOMR(Number(ref.amount)),
      credit: 0,
      referenceId: ref.id,
      referenceNumber: num,
      reservationId: ref.reservationId ?? null,
    });
  }

  // 5. Sort by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 6. Calculate running balance
  let balance = 0;
  for (const tx of transactions) {
    if (tx.type === "invoice") {
      balance = roundOMR(balance + tx.debit);
    } else if (tx.type === "payment") {
      balance = roundOMR(balance - tx.credit);
    } else {
      // return/refund
      balance = roundOMR(balance + tx.debit);
    }
    tx.runningBalance = balance;
  }

  // Summary (before type filtering)
  const totalCharged  = roundOMR(invoices.reduce((s, i) => s + Number(i.totalAmount), 0));
  const totalPaid     = roundOMR(payments.reduce((s, p) => s + Number(p.amount), 0));
  const totalReturned = roundOMR(refunds.reduce((s, r) => s + Number(r.amount), 0));
  const currentBalance = roundOMR(totalCharged - totalPaid + totalReturned);

  const summary = {
    totalCharged,
    totalPaid,
    totalReturned,
    currentBalance,
    invoiceCount: invoices.length,
    paymentCount: payments.length,
  };

  // Apply type filter
  let filtered = transactions;
  if (typeFilter === "invoices")  filtered = transactions.filter((t) => t.type === "invoice");
  if (typeFilter === "payments")  filtered = transactions.filter((t) => t.type === "payment");
  if (typeFilter === "returns")   filtered = transactions.filter((t) => t.type === "return");

  // 8. Reverse to newest-first before returning
  const reversed = [...filtered].reverse();

  return NextResponse.json(ser({ summary, transactions: reversed }));
}
