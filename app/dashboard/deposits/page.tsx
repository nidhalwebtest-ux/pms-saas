import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getEffectivePropertyIds, getSessionAccessibleProperties } from "@/lib/property-scope";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatAmount } from "@/lib/format-currency";
import DepositsFilters from "./DepositsFilters";
import DepositsTable from "./DepositsTable";
import type { DepositRow } from "./columns";

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function endOfDay(d: Date) { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; }

export default async function DepositsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const access = await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const orgId = orgUser.organizationId;
  const params = await searchParams;
  const q = params.q ?? "";
  const period = params.period ?? "all";
  const building = params.building ?? "";

  const currency = await getCurrentCurrency();
  const t = await getTranslations("deposits");
  const tList = await getTranslations("deposits.list");

  // Buildings the user may see (for the filter dropdown).
  const accessible = await getSessionAccessibleProperties();
  const buildings = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Building scope (drawer's propertyId), honoring an explicit building filter.
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

  const base: Prisma.BankTransactionWhereInput = {
    organizationId: orgId,
    type: "TRANSFER_OUT",
    isVoid: false,
    transferGroupId: { not: null },
    ...(propIds ? { bankAccount: { propertyId: { in: propIds } } } : {}),
  };

  const [allCount, todayCount, weekCount, monthCount] = await Promise.all([
    prisma.bankTransaction.count({ where: base }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("today") } }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("week") } }),
    prisma.bankTransaction.count({ where: { ...base, date: periodRange("month") } }),
  ]);

  const dateRange = periodRange(period);
  const where: Prisma.BankTransactionWhereInput = {
    ...base,
    ...(dateRange.gte || dateRange.lte ? { date: dateRange } : {}),
    ...(q ? {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { bankAccount: { property: { name: { contains: q, mode: "insensitive" } } } },
      ],
    } : {}),
  };

  const transfers = await prisma.bankTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
    select: {
      date: true, amount: true, reference: true, transferGroupId: true,
      bankAccount: { select: { property: { select: { name: true } } } },
    },
  });

  // Pair each drawer leg with its bank (DEPOSIT_IN) leg for the bank name.
  const groupIds = transfers.map((t) => t.transferGroupId!).filter(Boolean);
  const bankLegs = groupIds.length
    ? await prisma.bankTransaction.findMany({
        where: { transferGroupId: { in: groupIds }, type: "DEPOSIT_IN" },
        select: { transferGroupId: true, bankAccount: { select: { bankName: true } } },
      })
    : [];
  const bankByGroup = new Map(bankLegs.map((l) => [l.transferGroupId, l.bankAccount?.bankName ?? "—"]));

  const rows: DepositRow[] = transfers.map((tr) => ({
    groupId: tr.transferGroupId!,
    date: tr.date.toISOString(),
    building: tr.bankAccount?.property?.name ?? "—",
    bank: bankByGroup.get(tr.transferGroupId) ?? "—",
    amount: Math.abs(Number(tr.amount)),
    reference: tr.reference,
  }));

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const hasActiveFilters = !!q || !!building || period !== "all";
  const canManage = access.canDelete("reconciliation");

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <ArrowUpTrayIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {tList("summary", { count: rows.length, total: formatAmount(total, currency) })}
            </p>
          </div>
        </div>
        {access.canCreate("reconciliation") && (
          <Link
            href="/dashboard/deposits/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            {t("newDeposit")}
          </Link>
        )}
      </div>

      <div className="mb-4">
        <DepositsFilters
          currentPeriod={period}
          currentQ={q}
          currentBuilding={building}
          counts={{ all: allCount, today: todayCount, week: weekCount, month: monthCount }}
          buildings={buildings}
        />
      </div>

      <DepositsTable
        deposits={rows}
        currency={currency}
        hasActiveFilters={hasActiveFilters}
        canManage={canManage}
      />

      {rows.length > 0 && (
        <div className="mt-4 px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("totalsLabel", { count: rows.length })}{" "}
            <strong className="text-fg tabular-nums ltr-numbers ms-2">{formatAmount(total, currency)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
