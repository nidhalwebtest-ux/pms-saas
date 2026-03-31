import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { generateInvoicesForReservation } from "@/lib/invoice-engine";

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

// ── GET /api/invoices ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const sp            = new URL(req.url).searchParams;
  const status        = sp.get("status")        ?? "";
  const tenantId      = sp.get("tenantId")      ?? "";
  const reservationId = sp.get("reservationId") ?? "";
  const propertyId    = sp.get("propertyId")    ?? "";
  const dateFrom      = sp.get("dateFrom")      ?? "";
  const dateTo        = sp.get("dateTo")        ?? "";
  const search        = sp.get("search")        ?? "";
  const page          = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
  const limit         = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10)));
  const skip          = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = { organizationId: orgUser.organizationId };

  if (status)        where.status        = status;
  if (tenantId)      where.tenantId      = tenantId;
  if (reservationId) where.reservationId = reservationId;
  if (propertyId)    where.propertyId    = propertyId;

  if (dateFrom || dateTo) {
    where.dueDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { tenant: { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName:  { contains: search, mode: "insensitive" } },
      ]}},
      { reservation: { reservationNumber: { contains: search, mode: "insensitive" } } },
    ];
  }

  const include = {
    tenant: {
      select: { id: true, firstName: true, lastName: true, phone: true },
    },
    reservation: {
      select: {
        id: true, reservationNumber: true,
        startDate: true, endDate: true, rateType: true,
      },
    },
    property: { select: { id: true, name: true } },
    lineItems: { orderBy: { sortOrder: "asc" as const } },
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({ where, include, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.invoice.count({ where }),
  ]);

  // Status counts for tab badges
  const today = new Date();
  const [all, draft, issued, partiallyPaid, paid, cancelled, overdue] = await Promise.all([
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId } }),
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId, status: "DRAFT" } }),
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId, status: "ISSUED" } }),
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId, status: "PARTIALLY_PAID" } }),
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId, status: "PAID" } }),
    prisma.invoice.count({ where: { organizationId: orgUser.organizationId, status: "CANCELLED" } }),
    prisma.invoice.count({
      where: {
        organizationId: orgUser.organizationId,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: today },
      },
    }),
  ]);

  return NextResponse.json({
    invoices: ser(invoices),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    counts: { all, draft, issued, partiallyPaid, paid, cancelled, overdue },
  });
}

// ── POST /api/invoices ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  let body: { reservationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reservationId } = body;
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
  }

  // Verify reservation belongs to this org
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenant: { organizationId: orgUser.organizationId } },
    select: { id: true },
  });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  try {
    const result = await generateInvoicesForReservation(
      reservationId,
      orgUser.organizationId,
      orgUser.userId,
    );
    return NextResponse.json(ser(result), { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/invoices]", err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
