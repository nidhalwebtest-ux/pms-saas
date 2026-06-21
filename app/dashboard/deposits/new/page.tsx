import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requireAccess } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import NewDepositForm from "./NewDepositForm";

export default async function NewDepositPage() {
  await requireAccess("reconciliation", "CREATE");
  const orgUser = await requireOrgUser();
  const orgId = orgUser.organizationId;

  const t = await getTranslations("deposits");
  const tNew = await getTranslations("deposits.new");

  const accessible = await getSessionAccessibleProperties();
  const properties = await prisma.property.findMany({
    where: { organizationId: orgId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Current cash-drawer balance per building.
  const buildings = await Promise.all(
    properties.map(async (p) => {
      const drawer = await prisma.bankAccount.findFirst({
        where: { organizationId: orgId, type: "CASH", propertyId: p.id },
        select: { id: true, openingBalance: true },
      });
      let balance = 0;
      if (drawer) {
        const agg = await prisma.bankTransaction.aggregate({
          where: { bankAccountId: drawer.id, isVoid: false },
          _sum: { amount: true },
        });
        balance = Number(drawer.openingBalance) + Number(agg._sum.amount ?? 0);
      }
      return { id: p.id, name: p.name, balance };
    }),
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/deposits" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("newDeposit")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tNew("subtitle")}</p>
        </div>
      </div>

      {buildings.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-400">{tNew("noBuildings")}</p>
        </div>
      ) : (
        <NewDepositForm buildings={buildings} />
      )}
    </div>
  );
}
