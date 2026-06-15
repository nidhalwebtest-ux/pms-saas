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

// ── PATCH /api/invoices/[id]/cancel ──────────────────────────────────────────

export async function PATCH(
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
    select: { id: true, organizationId: true, status: true },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json(
      { error: "Cannot cancel a paid invoice" },
      { status: 400 },
    );
  }

  if (invoice.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Already cancelled" },
      { status: 400 },
    );
  }

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const reason = body.reason?.trim() ?? "";

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledReason: reason || null,
    },
  });

  return NextResponse.json({ invoice: ser(updated) });
}
