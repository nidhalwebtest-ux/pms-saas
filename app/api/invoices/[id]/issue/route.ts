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

// ── PATCH /api/invoices/[id]/issue — DRAFT → PENDING ─────────────────────────
// Issuing a DRAFT posts it: status → PENDING (the simplified model; ISSUED is
// legacy-only) and stamps issueDate = now (revenue posts on issueDate).

export async function PATCH(
  _req: NextRequest,
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

  if (invoice.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft invoices can be issued" },
      { status: 400 },
    );
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "PENDING", issueDate: new Date() },
  });

  return NextResponse.json({ invoice: ser(updated) });
}
