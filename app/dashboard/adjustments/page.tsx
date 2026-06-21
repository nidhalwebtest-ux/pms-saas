import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getEffectivePropertyIds, getSessionAccessibleProperties } from "@/lib/property-scope";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatAmount } from "@/lib/format-currency";
import AdjustmentsFilters from "./AdjustmentsFilters";
import AdjustmentsTable from "./AdjustmentsTable";
import type { AdjustmentRow } from "./columns";

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function endOfDay(d: Date) { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; }

export default async function AdjustmentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const orgId = orgUser.organizationId;
  const params = await searchParams;
  const period = params.period ?? "all";
  const building = params.building ?? "";

  const currency = await getCurrentCurrency();
  const t = await getTranslations("adjustments");
  const tList = await getTranslations("adjustments.list");

  const accessible = await getSessionAccessibleProperties();
  const buildings = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const propIds = await getEffectivePropertyIds(building);

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  function periodRange(p: string): { gte?: Date; lte?: Date } {
    if (p === "today") return { gte: today, lte: endOfDay(now) };
    if (p === "week") return { gte: weekStart, lte: endOfDay(now) };
    if (p === "month") return { gte: monthStart, lte: endOfDay(now) };
    return {};
  }

  // Reconciliation adjustments = ADJUSTMENT rows on a CASH drawer.
  const base: Prisma.BankTransactionWhereInput = {
    organizationId: orgId,
    type: "ADJUSTMENT",
    isVoid: false,
    bankAccount: { type: "CASH", ...(propIds ? { propertyId: { in: propIds } } : {}) },
  };

  const [allCount, todayCount, weekCount, monthCount] = await Promise.all([
    prisma.bankTransaction.count({ where: base }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("today") } }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("week") } }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("month") } }),
  ]);

  const dateRange = periodRange(period);
  const adjustments = await prisma.bankTransaction.findMany({
    where: { ...base, ...(dateRange.gte || dateRange.lte ? { date: dateRange } : {}) },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true, date: true, amount: true, description: true, cashierSessionId: true,
      bankAccount: { select: { property: { select: { name: true } } } },
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
    building: a.bankAccount?.property?.name ?? "—",
    amount: Number(a.amount),
    description: a.description,
    by: a.cashierSessionId ? bySession.get(a.cashierSessionId) ?? null : null,
  }));

  const net = rows.reduce((s, r) => s + r.amount, 0);
  const hasActiveFilters = !!building || period !== "all";

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-md">
          <ScaleIcon className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tList("summary", { count: rows.length, net: formatAmount(net, currency) })}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <AdjustmentsFilters
          currentPeriod={period}
          currentBuilding={building}
          counts={{ all: allCount, today: todayCount, week: weekCount, month: monthCount }}
          buildings={buildings}
        />
      </div>

      <AdjustmentsTable adjustments={rows} currency={currency} hasActiveFilters={hasActiveFilters} />

      {rows.length > 0 && (
        <div className="mt-4 px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("netLabel", { count: rows.length })}{" "}
            <strong className={`tabular-nums ltr-numbers ms-2 ${Math.abs(net) < 0.001 ? "text-fg" : net > 0 ? "text-success-700" : "text-danger-600"}`}>
              {net > 0 ? "+" : ""}{formatAmount(net, currency)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
