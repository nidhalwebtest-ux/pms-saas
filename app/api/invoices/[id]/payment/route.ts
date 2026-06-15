import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/invoice-engine";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

// ── POST /api/invoices/[id]/payment — record payment against this invoice ─────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("payments", "CREATE");
  if (__denied) return __denied;
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id } = await params;

  // Fetch invoice with org guard
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true, organizationId: true, status: true,
      tenantId: true, balanceDue: true,
    },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot record payment on a cancelled invoice" }, { status: 400 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 400 });
  }

  let body: {
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);

  if (amount <= 0) {
    return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
  }

  const balanceDue = Number(invoice.balanceDue);
  if (amount > balanceDue) {
    return NextResponse.json(
      { error: `amount (${amount.toFixed(3)}) exceeds balance due (${balanceDue.toFixed(3)})` },
      { status: 400 },
    );
  }

  if (!body.method) {
    return NextResponse.json({ error: "method is required" }, { status: 400 });
  }

  try {
    const result = await recordPayment({
      tenantId:  invoice.tenantId,
      amount,
      method:    body.method,
      reference: body.reference,
      notes:     body.notes,
      orgId:     orgUser.organizationId,
      userId:    orgUser.userId,
      invoiceAllocations: [{ invoiceId: id, amount }],
    });

    return NextResponse.json(ser(result), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/invoices/[id]/payment]", err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
