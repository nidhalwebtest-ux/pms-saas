import { NextRequest, NextResponse } from "next/server";
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

// ── POST /api/payments — record payment with auto-allocation ─────────────────

export async function POST(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  let body: {
    tenantId?: string;
    amount?: number;
    method?: string;
    reference?: string;
    notes?: string;
    invoiceAllocations?: { invoiceId: string; amount: number }[];
    reservationId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, amount, method, reference, notes, invoiceAllocations, reservationId } = body;

  if (!tenantId)  return NextResponse.json({ error: "tenantId is required" },  { status: 400 });
  if (!amount)    return NextResponse.json({ error: "amount is required" },    { status: 400 });
  if (!method)    return NextResponse.json({ error: "method is required" },    { status: 400 });

  if (Number(amount) <= 0) {
    return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
  }

  // Verify tenant belongs to org
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Verify any invoice allocations belong to this org
  if (invoiceAllocations?.length) {
    const invoiceIds = invoiceAllocations.map((a) => a.invoiceId);
    const invoices   = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, organizationId: true },
    });
    for (const inv of invoices) {
      if (inv.organizationId !== orgUser.organizationId) {
        return NextResponse.json({ error: "Unauthorized access to invoice" }, { status: 403 });
      }
    }
    if (invoices.length !== invoiceIds.length) {
      return NextResponse.json({ error: "One or more invoices not found" }, { status: 404 });
    }
  }

  try {
    const result = await recordPayment({
      tenantId,
      amount:             Number(amount),
      method,
      reference,
      notes,
      orgId:              orgUser.organizationId,
      userId:             orgUser.userId,
      reservationId,
      invoiceAllocations,
    });

    return NextResponse.json(ser(result), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/payments]", err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

// ── GET /api/payments — list payments for org ─────────────────────────────────

export async function GET(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const sp            = new URL(req.url).searchParams;
  const tenantId      = sp.get("tenantId")      ?? "";
  const reservationId = sp.get("reservationId") ?? "";
  const page          = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
  const limit         = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10)));
  const skip          = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: orgUser.organizationId };

  if (tenantId)      where.tenantId      = tenantId;
  if (reservationId) where.reservationId = reservationId;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        tenant:      { select: { id: true, firstName: true, lastName: true } },
        reservation: { select: { id: true, reservationNumber: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments: ser(payments),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
