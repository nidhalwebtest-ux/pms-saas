import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTenantFinancialSummary } from "@/lib/invoice-engine";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

// ── GET /api/tenants/[id]/financial-summary ───────────────────────────────────

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

  const { id: tenantId } = await params;

  // Verify tenant belongs to org
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, organizationId: true },
  });

  if (!tenant || tenant.organizationId !== orgUser.organizationId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  try {
    const summary = await getTenantFinancialSummary(tenantId, orgUser.organizationId);
    return NextResponse.json({ summary: ser(summary) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/tenants/[id]/financial-summary]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
