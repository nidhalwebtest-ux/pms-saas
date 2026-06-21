import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

function parseMoney(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return "0";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(3);
}

async function loadDrawer(id: string, organizationId: string) {
  const d = await prisma.bankAccount.findUnique({ where: { id } });
  return d && d.organizationId === organizationId && d.type === "CASH" ? d : null;
}

// PUT /api/cash-drawers/[id] — edit the opening float / label. The float may be
// changed only while the drawer has no posted ledger movement (still "opening").
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const drawer = await loadDrawer(id, orgUser.organizationId);
  if (!drawer) return NextResponse.json({ error: "Cash drawer not found" }, { status: 404 });

  const body = await req.json();
  const openingBalance = parseMoney(body.openingBalance);
  if (openingBalance === null) return NextResponse.json({ error: "Invalid opening float" }, { status: 400 });

  const floatChanged = openingBalance !== Number(drawer.openingBalance).toFixed(3);
  if (floatChanged) {
    const movement = await prisma.bankTransaction.count({ where: { bankAccountId: id, isVoid: false } });
    if (movement > 0) {
      return NextResponse.json(
        { error: "Opening float can't be changed once the drawer has transactions. Use a reconciliation adjustment instead." },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: {
      openingBalance,
      label: (body.label as string)?.trim() || null,
    },
  });
  return NextResponse.json({ success: true, drawer: updated });
}

// PATCH /api/cash-drawers/[id] — toggle active/inactive.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const drawer = await loadDrawer(id, orgUser.organizationId);
  if (!drawer) return NextResponse.json({ error: "Cash drawer not found" }, { status: 404 });

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: { isActive: !drawer.isActive },
  });
  return NextResponse.json({ success: true, drawer: updated });
}
