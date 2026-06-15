import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { generatePendingMonthlyInvoices } from "@/lib/invoice-engine";

function ser(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_, v) =>
      v != null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function"
        ? Number(v)
        : v,
    ),
  );
}

// ── POST /api/invoices/generate-monthly ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const __denied = await forbiddenIfNo("invoices", "CREATE");
  if (__denied) return __denied;
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  let body: { orgId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Use the caller's org — ignore any supplied orgId that differs (security)
  const orgId = orgUser.organizationId;

  // If caller supplied an explicit orgId it must match their own
  if (body.orgId && body.orgId !== orgId) {
    return NextResponse.json(
      { error: "orgId does not match your organization" },
      { status: 403 },
    );
  }

  try {
    const result = await generatePendingMonthlyInvoices(orgId);
    return NextResponse.json(ser(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/invoices/generate-monthly]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
