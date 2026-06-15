import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

// ── Decimal serialisation helper ──────────────────────────────────────────────

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

// ── Shared invoice lookup (guards org ownership) ──────────────────────────────

async function fetchInvoice(id: string, organizationId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: {
        include: {
          reservationUnits: { include: { unit: true } },
        },
      },
      property: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      allocations: {
        include: {
          payment: {
            select: {
              id: true, paymentNumber: true, amount: true,
              date: true, method: true, reference: true, notes: true,
            },
          },
        },
      },
      payments: true,
    },
  });

  if (!invoice || invoice.organizationId !== organizationId) return null;
  return invoice;
}

// ── GET /api/invoices/[id] ────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id } = await params;
  const invoice = await fetchInvoice(id, orgUser.organizationId);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ invoice: ser(invoice) });
}

// ── PUT /api/invoices/[id] — update a DRAFT invoice ───────────────────────────

export async function PUT(
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
  const invoice = await fetchInvoice(id, orgUser.organizationId);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited" },
      { status: 400 },
    );
  }

  let body: { discountAmount?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subtotal       = Number(invoice.subtotal);
  const taxAmount      = Number(invoice.taxAmount);
  const amountPaid     = Number(invoice.amountPaid);
  const discountAmount = body.discountAmount != null
    ? Math.round(Math.max(0, body.discountAmount) * 1000) / 1000
    : Number(invoice.discountAmount);

  const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 1000) / 1000;
  const balanceDue  = Math.round(Math.max(0, totalAmount - amountPaid) * 1000) / 1000;

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      discountAmount,
      totalAmount,
      balanceDue,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  return NextResponse.json({ invoice: ser(updated) });
}
