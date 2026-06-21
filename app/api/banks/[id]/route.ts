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

async function loadOwned(id: string, organizationId: string) {
  const bank = await prisma.bankAccount.findUnique({ where: { id } });
  // Only real bank accounts are managed here; cash drawers use /api/cash-drawers.
  return bank && bank.organizationId === organizationId && bank.type === "BANK" ? bank : null;
}

// PUT /api/banks/[id] — edit a bank account.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const bank = await loadOwned(id, orgUser.organizationId);
  if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const body = await req.json();
  const bankName = (body.bankName as string)?.trim();
  if (!bankName) return NextResponse.json({ error: "Bank name is required" }, { status: 400 });

  const openingBalance = parseMoney(body.openingBalance);
  if (openingBalance === null) return NextResponse.json({ error: "Invalid opening balance" }, { status: 400 });

  const makeDefault = body.isDefault === true;

  const updated = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.bankAccount.updateMany({
        where: { organizationId: orgUser.organizationId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    return tx.bankAccount.update({
      where: { id },
      data: {
        bankName,
        label: (body.label as string)?.trim() || null,
        accountNumber: (body.accountNumber as string)?.trim() || null,
        currency: (body.currency as string)?.trim() || "OMR",
        openingBalance,
        // Never silently un-default the last default; only flips on when asked.
        ...(makeDefault ? { isDefault: true } : {}),
      },
    });
  });

  return NextResponse.json({ success: true, bank: updated });
}

// PATCH /api/banks/[id] — toggle active/inactive.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const bank = await loadOwned(id, orgUser.organizationId);
  if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: { isActive: !bank.isActive },
  });
  return NextResponse.json({ success: true, bank: updated });
}

// DELETE /api/banks/[id] — remove a bank account (allowed only while unused).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await forbiddenIfNo("banks", "FULL");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { id } = await params;
  const bank = await loadOwned(id, orgUser.organizationId);
  if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

  // Phase 2+ links payments to banks; once that exists, block deletion of a bank
  // with history and steer the user to deactivate instead. For Phase 1 there are
  // no links yet, so a plain delete is safe.
  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
