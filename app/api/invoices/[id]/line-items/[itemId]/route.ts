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

async function recalcInvoiceTotals(invoiceId: string) {
  const items = await prisma.invoiceLineItem.findMany({
    where: { invoiceId },
    select: { lineTotal: true },
  });

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { discountAmount: true, taxAmount: true, amountPaid: true },
  });

  if (!invoice) return;

  const subtotal       = items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const discountAmount = Number(invoice.discountAmount);
  const taxAmount      = Number(invoice.taxAmount);
  const amountPaid     = Number(invoice.amountPaid);

  const roundOMR = (v: number) => Math.round(v * 1000) / 1000;

  const totalAmount = roundOMR(subtotal - discountAmount + taxAmount);
  const balanceDue  = roundOMR(Math.max(0, totalAmount - amountPaid));

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal:    roundOMR(subtotal),
      totalAmount,
      balanceDue,
    },
  });
}

// ── DELETE /api/invoices/[id]/line-items/[itemId] ─────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id, itemId } = await params;

  // Verify invoice ownership
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, organizationId: true, status: true },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft invoices can be modified" },
      { status: 400 },
    );
  }

  // Verify line item belongs to this invoice
  const lineItem = await prisma.invoiceLineItem.findUnique({
    where: { id: itemId },
    select: { id: true, invoiceId: true },
  });

  if (!lineItem || lineItem.invoiceId !== id) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  await prisma.invoiceLineItem.delete({ where: { id: itemId } });
  await recalcInvoiceTotals(id);

  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ invoice: ser(updatedInvoice) });
}
