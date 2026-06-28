import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getEffectivePropertyIds } from "@/lib/property-scope";

function roundOMR(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: tenantId } = await params;

  // Verify tenant belongs to org
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true, firstName: true, lastName: true },
  });
  if (!tenant || tenant.organizationId !== orgUser.organizationId) {
    return new Response("Tenant not found", { status: 404 });
  }

  const tenantName = `${tenant.firstName} ${tenant.lastName}`.replace(/[^a-zA-Z0-9 ]/g, "");

  // Scope to the globally-selected building (matches the on-screen ledger).
  const propIds = await getEffectivePropertyIds(await getSelectedPropertyId());
  const resScope: Prisma.ReservationWhereInput = propIds
    ? {
        OR: [
          { unit: { propertyId: { in: propIds } } },
          { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
        ],
      }
    : {};
  const invoicePropScope: Prisma.InvoiceWhereInput = propIds ? { propertyId: { in: propIds } } : {};
  const txnResScope = propIds ? { reservation: resScope } : {};

  // Fetch all data (same as ledger endpoint, no date filtering for export)
  const [invoices, payments, refunds, returns] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        status: { notIn: ["CANCELLED", "VOID", "DRAFT"] },
        ...invoicePropScope,
      },
      select: {
        id: true,
        invoiceNumber: true,
        periodStart: true,
        periodEnd: true,
        totalAmount: true,
        issueDate: true,
        monthNumber: true,
        reservationId: true,
      },
      orderBy: { issueDate: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        isRefund: false,
        ...txnResScope,
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
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        isRefund: true,
        ...txnResScope,
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
    }),
    prisma.return.findMany({
      where: {
        tenantId,
        organizationId: orgUser.organizationId,
        status: "active",
        ...txnResScope,
      },
      select: {
        id: true,
        returnNumber: true,
        returnAmount: true,
        createdAt: true,
        reservationId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type TxRow = {
    date: Date;
    type: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
  };

  const rows: TxRow[] = [];

  for (const inv of invoices) {
    const periodDesc =
      inv.periodStart && inv.periodEnd
        ? ` (${new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`
        : "";
    const monthLabel = inv.monthNumber ? ` — Month ${inv.monthNumber}` : "";
    rows.push({
      date: inv.issueDate,
      type: "Invoice",
      description: `${inv.invoiceNumber}${monthLabel}${periodDesc}`,
      reference: inv.invoiceNumber,
      debit: roundOMR(Number(inv.totalAmount)),
      credit: 0,
    });
  }

  for (const pay of payments) {
    const num = pay.paymentNumber ?? pay.id.slice(0, 8).toUpperCase();
    rows.push({
      date: pay.date,
      type: "Payment",
      description: `Payment ${num} — ${pay.method.charAt(0) + pay.method.slice(1).toLowerCase().replace("_", " ")}`,
      reference: num,
      debit: 0,
      credit: roundOMR(Number(pay.amount)),
    });
  }

  for (const ret of returns) {
    rows.push({
      date: ret.createdAt,
      type: "Return",
      description: `Return ${ret.returnNumber}`,
      reference: ret.returnNumber,
      debit: 0,
      credit: roundOMR(Number(ret.returnAmount)),
    });
  }

  for (const ref of refunds) {
    const num = ref.paymentNumber ?? ref.id.slice(0, 8).toUpperCase();
    rows.push({
      date: ref.date,
      type: "Refund",
      description: `Refund ${num}`,
      reference: num,
      debit: roundOMR(Number(ref.amount)),
      credit: 0,
    });
  }

  // Sort by date ascending
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance (AR view): debit increases, credit decreases.
  let balance = 0;
  const finalRows = rows.map((row) => {
    balance = roundOMR(balance + row.debit - row.credit);
    return { ...row, balance };
  });

  // Build CSV
  const headers = ["Date", "Type", "Description", "Reference", "Debit (OMR)", "Credit (OMR)", "Running Balance (OMR)"];
  const csvLines = [headers.map(escapeCsvField).join(",")];

  for (const row of finalRows) {
    const line = [
      new Date(row.date).toLocaleDateString("en-GB"),
      row.type,
      row.description,
      row.reference,
      row.debit > 0 ? row.debit.toFixed(3) : "",
      row.credit > 0 ? row.credit.toFixed(3) : "",
      row.balance.toFixed(3),
    ].map(escapeCsvField).join(",");
    csvLines.push(line);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `ledger-${tenantName.replace(/ /g, "-")}-${dateStr}.csv`;

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
