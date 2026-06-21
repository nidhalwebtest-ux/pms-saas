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

// GET /api/cash-drawers — list the org's per-building cash drawers + which
// buildings still have none (so the UI can offer to set their opening float).
export async function GET() {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const orgId = orgUser.organizationId;

  const [drawers, properties] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { organizationId: orgId, type: "CASH" },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.property.findMany({
      where: { organizationId: orgId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Current balance + whether any ledger movement exists (float still editable
  // only while the drawer is untouched).
  const withBalance = await Promise.all(
    drawers.map(async (d) => {
      const agg = await prisma.bankTransaction.aggregate({
        where: { bankAccountId: d.id, isVoid: false },
        _sum: { amount: true },
        _count: true,
      });
      const movement = Number(agg._sum.amount ?? 0);
      return {
        id: d.id,
        propertyId: d.propertyId,
        propertyName: d.property?.name ?? "—",
        openingBalance: d.openingBalance.toString(),
        balance: (Number(d.openingBalance) + movement).toFixed(3),
        txnCount: agg._count,
        isActive: d.isActive,
      };
    }),
  );

  const usedPropertyIds = new Set(drawers.map((d) => d.propertyId));
  const availableProperties = properties.filter((p) => !usedPropertyIds.has(p.id));

  return NextResponse.json({ success: true, drawers: withBalance, availableProperties });
}

// POST /api/cash-drawers — initialize a drawer for a building with an opening float.
export async function POST(req: NextRequest) {
  const denied = await forbiddenIfNo("banks", "EDIT");
  if (denied) return denied;
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const orgId = orgUser.organizationId;

  const body = await req.json();
  const propertyId = (body.propertyId as string)?.trim();
  if (!propertyId) return NextResponse.json({ error: "A building is required" }, { status: 400 });

  const openingBalance = parseMoney(body.openingBalance);
  if (openingBalance === null) return NextResponse.json({ error: "Invalid opening float" }, { status: 400 });

  // Building must belong to the org.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: orgId },
    select: { id: true },
  });
  if (!property) return NextResponse.json({ error: "Invalid building" }, { status: 400 });

  // One drawer per building.
  const existing = await prisma.bankAccount.findFirst({
    where: { organizationId: orgId, type: "CASH", propertyId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "This building already has a cash drawer" }, { status: 409 });

  const created = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      type:           "CASH",
      propertyId,
      bankName:       "Cash Drawer",
      label:          (body.label as string)?.trim() || null,
      currency:       "OMR",
      openingBalance,
      isActive:       true,
      isDefault:      false,
    },
  });

  return NextResponse.json({ success: true, drawer: created });
}
