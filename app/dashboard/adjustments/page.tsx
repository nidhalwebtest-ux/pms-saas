import { Prisma } from "@prisma/client";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getEffectivePropertyIds, getSessionAccessibleProperties } from "@/lib/property-scope";
import { getCurrentCurrency } from "@/lib/get-org";
import AdjustmentsView from "./AdjustmentsView";
import type { AdjustmentRow } from "./columns";

export default async function AdjustmentsListPage() {
  await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const orgId = orgUser.organizationId;

  const currency = await getCurrentCurrency();

  const accessible = await getSessionAccessibleProperties();
  const buildings = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Sidebar property selector scope (no per-page building param — that filter
  // now happens client-side over the rows loaded here).
  const propIds = await getEffectivePropertyIds();

  // Reconciliation adjustments = ADJUSTMENT rows on a CASH drawer. Load ALL
  // in-scope rows once — tabs / building / search filter client-side.
  const base: Prisma.BankTransactionWhereInput = {
    organizationId: orgId,
    type: "ADJUSTMENT",
    isVoid: false,
    bankAccount: { type: "CASH", ...(propIds ? { propertyId: { in: propIds } } : {}) },
  };

  const adjustments = await prisma.bankTransaction.findMany({
    where: base,
    orderBy: { date: "desc" },
    take: 5000,
    select: {
      id: true, date: true, amount: true, description: true, cashierSessionId: true,
      bankAccount: { select: { property: { select: { id: true, name: true } } } },
    },
  });

  // Map the linked session → who reconciled.
  const sessionIds = adjustments.map((a) => a.cashierSessionId).filter((x): x is string => !!x);
  const sessions = sessionIds.length
    ? await prisma.cashierSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, lockedByName: true },
      })
    : [];
  const bySession = new Map(sessions.map((s) => [s.id, s.lockedByName]));

  const rows: AdjustmentRow[] = adjustments.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    propertyId: a.bankAccount?.property?.id ?? null,
    building: a.bankAccount?.property?.name ?? "—",
    amount: Number(a.amount),
    description: a.description,
    by: a.cashierSessionId ? bySession.get(a.cashierSessionId) ?? null : null,
  }));

  return <AdjustmentsView adjustments={rows} currency={currency} buildings={buildings} />;
}
