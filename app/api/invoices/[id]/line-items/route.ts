import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
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

// ── Recalculate invoice totals from its line items ────────────────────────────

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

// ── POST /api/invoices/[id]/line-items — add line item ────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("invoices", "CREATE");
  if (__denied) return __denied;
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true, organizationId: true, status: true,
      lineItems: { select: { sortOrder: true } },
    },
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

  let body: {
    description?: string;
    category?: string;
    quantity?: number;
    unitPrice?: number;
    unitId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { description, category, quantity, unitPrice, unitId } = body;

  if (!description || quantity == null || unitPrice == null) {
    return NextResponse.json(
      { error: "description, quantity, and unitPrice are required" },
      { status: 400 },
    );
  }

  const qty       = Number(quantity);
  const price     = Number(unitPrice);
  const lineTotal = Math.round(qty * price * 1000) / 1000;

  const maxSort    = invoice.lineItems.reduce((m, i) => Math.max(m, i.sortOrder), 0);
  const sortOrder  = maxSort + 1;

  const lineItem = await prisma.invoiceLineItem.create({
    data: {
      invoiceId:     id,
      organizationId: orgUser.organizationId,
      description,
      category:      (category ?? "ROOM_CHARGE") as never,
      quantity:      qty,
      unitPrice:     price,
      lineTotal,
      sortOrder,
      ...(unitId ? { unitId } : {}),
    },
  });

  await recalcInvoiceTotals(id);

  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ lineItem: ser(lineItem), invoice: ser(updatedInvoice) }, { status: 201 });
}
