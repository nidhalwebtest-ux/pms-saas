import { assertView } from "@/lib/access";
import { BuildingStorefrontIcon, PlusIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import VendorsView from "./VendorsView";

export type VendorRow = {
  id: string;
  name: string;
  nameAr: string | null;
  categoryId: string | null;
  categoryName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  totalSpendThisYear: number;
  expenseCount: number;
};

export default async function VendorsPage() {
  const access = await assertView("vendors");
  const orgId = access.organizationId;

  const t = await getTranslations("vendors");

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [raw, categories, spendGroups, countGroups] = await Promise.all([
    prisma.vendor.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, nameAr: true, categoryId: true,
        phone: true, email: true, isActive: true, createdAt: true,
        category: { select: { name: true, nameAr: true } },
      },
    }),
    prisma.expenseCat.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameAr: true },
    }),
    // Approved/processed spend this year, per vendor — matches the report's
    // "only processed/approved expenses count" correctness rule.
    prisma.expense.groupBy({
      by: ["vendorId"],
      where: {
        organizationId: orgId,
        vendorId: { not: null },
        status: { in: ["APPROVED", "PROCESSED"] },
        submittedAt: { gte: yearStart },
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["vendorId"],
      where: { organizationId: orgId, vendorId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const spendByVendor = new Map<string, number>();
  for (const g of spendGroups) if (g.vendorId) spendByVendor.set(g.vendorId, Number(g._sum.amount ?? 0));

  const countByVendor = new Map<string, number>();
  for (const g of countGroups) if (g.vendorId) countByVendor.set(g.vendorId, g._count._all);

  const vendors: VendorRow[] = raw.map((v) => ({
    id: v.id,
    name: v.name,
    nameAr: v.nameAr,
    categoryId: v.categoryId,
    categoryName: v.category?.name ?? null,
    phone: v.phone,
    email: v.email,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
    totalSpendThisYear: spendByVendor.get(v.id) ?? 0,
    expenseCount: countByVendor.get(v.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BuildingStorefrontIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("recordsCount", { count: vendors.length })}</p>
          </div>
        </div>
        {access.canCreate("vendors") && (
          <Link
            href="/dashboard/vendors/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newVendorBtn")}
          </Link>
        )}
      </div>

      <VendorsView vendors={vendors} categories={categories} />
    </div>
  );
}
