import { NextRequest, NextResponse } from "next/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { forbiddenIfNo } from "@/lib/access";

/** Parse a money string/number into a 3dp-safe string, or null if invalid. */
function parseMoney(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return "0";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(3);
}

// GET /api/banks — list the org's bank accounts.
export async function GET() {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const banks = await prisma.bankAccount.findMany({
    where: { organizationId: orgUser.organizationId, type: "BANK" },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { bankName: "asc" }],
  });

  return NextResponse.json({ success: true, banks });
}

// POST /api/banks — create a bank account.
export async function POST(req: NextRequest) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const body = await req.json();
  const bankName = (body.bankName as string)?.trim();
  if (!bankName) return NextResponse.json({ error: "Bank name is required" }, { status: 400 });

  const openingBalance = parseMoney(body.openingBalance);
  if (openingBalance === null) return NextResponse.json({ error: "Invalid opening balance" }, { status: 400 });

  const makeDefault = body.isDefault === true;

  const created = await prisma.$transaction(async (tx) => {
    // Only one default account per org.
    if (makeDefault) {
      await tx.bankAccount.updateMany({
        where: { organizationId: orgUser.organizationId, type: "BANK", isDefault: true },
        data: { isDefault: false },
      });
    }
    const count = await tx.bankAccount.count({ where: { organizationId: orgUser.organizationId, type: "BANK" } });
    return tx.bankAccount.create({
      data: {
        organizationId: orgUser.organizationId,
        type:           "BANK",
        bankName,
        label: (body.label as string)?.trim() || null,
        accountNumber: (body.accountNumber as string)?.trim() || null,
        currency: (body.currency as string)?.trim() || "OMR",
        openingBalance,
        isDefault: makeDefault || count === 0, // first account becomes default
        sortOrder: count,
      },
    });
  });

  return NextResponse.json({ success: true, bank: created });
}
