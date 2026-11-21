import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { assertView } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getEffectivePropertyIds, getSessionAccessibleProperties } from "@/lib/property-scope";
import { getCurrentCurrency } from "@/lib/get-org";
import DepositsView from "./DepositsView";
import type { DepositRow } from "./columns";

export default async function DepositsListPage() {
  const access = await assertView("reconciliation");
  const orgUser = await requireOrgUser();
  const orgId = orgUser.organizationId;

  const currency = await getCurrentCurrency();
  const t = await getTranslations("deposits");

  // Buildings the user may see (for the filter dropdown).
  const accessible = await getSessionAccessibleProperties();
  const buildings = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Building scope (drawer's propertyId) from the sidebar property selector.
  const propIds = await getEffectivePropertyIds();

  // Load ALL deposits in scope in ONE query. Filtering/tabs/search and the
  // footer total are computed client-side over these rows — no DB refetch.
  const where: Prisma.BankTransactionWhereInput = {
    organizationId: orgId,
    type: "TRANSFER_OUT",
    isVoid: false,
    transferGroupId: { not: null },
    ...(propIds ? { bankAccount: { propertyId: { in: propIds } } } : {}),
  };

  const transfers = await prisma.bankTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    take: 5000,
    select: {
      date: true, amount: true, reference: true, transferGroupId: true,
      bankAccount: { select: { propertyId: true, property: { select: { name: true } } } },
    },
  });

  // Pair each drawer leg with its bank (DEPOSIT_IN) leg for the bank name.
  const groupIds = transfers.map((tr) => tr.transferGroupId!).filter(Boolean);
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
    buildingId: tr.bankAccount?.propertyId ?? "",
    building: tr.bankAccount?.property?.name ?? "—",
    bank: bankByGroup.get(tr.transferGroupId) ?? "—",
    amount: Math.abs(Number(tr.amount)),
    reference: tr.reference,
  }));

  const canManage = access.can("depositDelete", "VIEW");

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <ArrowUpTrayIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          </div>
        </div>
        {access.can("depositCreate", "VIEW") && (
          <Link
            href="/dashboard/deposits/new"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            {t("newDeposit")}
          </Link>
        )}
      </div>

      <DepositsView
        deposits={rows}
        currency={currency}
        buildings={buildings}
        canManage={canManage}
      />
    </div>
  );
}
