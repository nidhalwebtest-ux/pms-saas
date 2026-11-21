import { notFound } from "next/navigation";
import { assertView } from "@/lib/access";
import Link from "next/link";
import {
  PencilSquareIcon,
  PhoneIcon,
  ArrowLeftIcon,
  ListBulletIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar, enGB } from "date-fns/locale";
import { waLink } from "@/utils/whatsapp";
import VendorExpensesList from "./VendorExpensesList";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  );
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const t = await getTranslations("vendors.detail");
  const tFields = await getTranslations("vendors.detail.fields");
  const tSections = await getTranslations("vendors.detail.sections");
  const locale = await getLocale();
  const dfLocale = locale === "ar" ? ar : enGB;
  const fmtMonY = (d: Date) => format(d, "MMM yyyy", { locale: dfLocale });

  const access = await assertView("vendors");
  const orgId = access.organizationId;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: { category: { select: { name: true, nameAr: true } } },
  });

  if (!vendor || vendor.organizationId !== orgId) notFound();

  const [expenses, spendAgg] = await Promise.all([
    prisma.expense.findMany({
      where: { vendorId: id, organizationId: orgId },
      orderBy: { submittedAt: "desc" },
      take: 200,
      select: {
        id: true, expenseNumber: true, description: true, amount: true,
        status: true, submittedAt: true, processedAt: true,
        property: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.expense.aggregate({
      where: { vendorId: id, organizationId: orgId, status: { in: ["APPROVED", "PROCESSED"] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const canEditVendor = access.canEdit("vendors");
  const whatsappHref = waLink(vendor.phone);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link href="/dashboard/vendors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" /> {t("back")}
        </Link>
      </div>

      {/* Header */}
      <div className="md:flex md:items-start md:justify-between mb-6 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BuildingStorefrontIcon className="h-7 w-7 text-blue-700" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
              {!vendor.isActive && (
                <Badge tone="neutral" appearance="subtle" size="md">{t("inactive")}</Badge>
              )}
            </div>
            {vendor.nameAr && (
              <p className="text-lg text-gray-500 mt-0.5" dir="rtl">{vendor.nameAr}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {vendor.category && <span>{vendor.category.name}</span>}
              <span>{t("since", { date: fmtMonY(vendor.createdAt) })}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 md:mt-0 flex-shrink-0">
          <Link
            href="/dashboard/vendors"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <ListBulletIcon className="h-4 w-4 text-gray-400" />
            {t("vendorsList")}
          </Link>
          {canEditVendor && (
            <Link
              href={`/dashboard/vendors/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <PencilSquareIcon className="h-4 w-4 text-gray-400" />
              {t("editVendor")}
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-purple-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("kpi.totalSpend")}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">
            {Number(spendAgg._sum.amount ?? 0).toFixed(3)} OMR
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-blue-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("kpi.expenseCount")}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">{spendAgg._count._all}</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: contact/bank info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{tSections("contact")}</h3>
            </div>
            <dl className="px-4 divide-y divide-gray-100">
              <InfoRow label={tFields("contactPerson")} value={vendor.contactPerson} />
              <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">{tFields("phone")}</dt>
                <dd className="mt-1 text-sm sm:col-span-2 sm:mt-0">
                  {vendor.phone ? (
                    whatsappHref ? (
                      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-success-700 hover:underline ltr-numbers">
                        {vendor.phone}
                      </a>
                    ) : (
                      <span className="text-gray-900 ltr-numbers">{vendor.phone}</span>
                    )
                  ) : "—"}
                </dd>
              </div>
              <InfoRow label={tFields("email")} value={vendor.email} />
              <InfoRow label={tFields("address")} value={vendor.address} />
              <InfoRow label={tFields("taxNumber")} value={vendor.taxNumber} />
            </dl>
          </div>

          {(vendor.bankAccountName || vendor.bankName || vendor.accountNumber) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <BanknotesIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">{tSections("bank")}</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label={tFields("bankAccountName")} value={vendor.bankAccountName} />
                <InfoRow label={tFields("bankName")} value={vendor.bankName} />
                <InfoRow label={tFields("accountNumber")} value={vendor.accountNumber} />
              </dl>
            </div>
          )}

          {vendor.notes && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 uppercase mb-1">{tSections("notes")}</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{vendor.notes}</p>
            </div>
          )}
        </div>

        {/* RIGHT: expenses list */}
        <div className="lg:col-span-2">
          <VendorExpensesList
            expenses={expenses.map((e) => ({
              id: e.id,
              expenseNumber: e.expenseNumber,
              description: e.description,
              amount: Number(e.amount),
              status: e.status,
              submittedAt: e.submittedAt.toISOString(),
              propertyName: e.property.name,
              categoryName: e.category.name,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
