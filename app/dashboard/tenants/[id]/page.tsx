import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getSessionAccess, assertView } from "@/lib/access";
import Link from "next/link";
import Image from "next/image";
import {
  PencilSquareIcon,
  BanknotesIcon,
  PhoneIcon,
  IdentificationIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
  ListBulletIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  Badge,
  getTenantClassBadge,
} from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar, enGB } from "date-fns/locale";
import TenantLedger from "./TenantLedger";
import TenantDetailTabs from "./TenantDetailTabs";
import TransactionsPanel from "@/components/dashboard/transactions/TransactionsPanel";
import type { TransactionData } from "@/components/dashboard/transactions/TransactionSections";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const t         = await getTranslations("tenants.detail");
  const tFields   = await getTranslations("tenants.detail.fields");
  const tSections = await getTranslations("tenants.detail.sections");
  const tKpi      = await getTranslations("tenants.detail.kpi");
  const tTabs     = await getTranslations("tenants.detail.tabs");
  const tGen      = await getTranslations("tenants.detail.gender");
  const tCls      = await getTranslations("tenants.classifications");
  const tTypes    = await getTranslations("tenants.types");
  const tSrc      = await getTranslations("tenants.sources");
  const tIdTypes  = await getTranslations("tenants.idTypes");
  const tPay      = await getTranslations("tenants.paymentMethods");
  const locale    = await getLocale();
  const dfLocale  = locale === "ar" ? ar : enGB;
  const fmtDate   = (d: Date | string) => format(new Date(d), "dd/MM/yyyy", { locale: dfLocale });
  const fmtMonY   = (d: Date | string) => format(new Date(d), "MMM yyyy", { locale: dfLocale });
  const tryT = (fn: (k: never) => string, key: string | null | undefined) => {
    if (!key) return null;
    try { return fn(key as never); } catch { return key; }
  };

  await assertView("tenants");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          unit: { include: { property: { select: { name: true } } } },
          reservationUnits: { include: { unit: { select: { name: true } } } },
        },
        orderBy: { startDate: "desc" },
        take: 50,
      },
      payments: {
        include: { reservation: { select: { id: true, reservationNumber: true } } },
        orderBy: { date: "desc" },
        take: 50,
      },
    },
  });

  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  const canEditTenant = (await getSessionAccess())?.canEdit("tenants") ?? false;

  // Invoices + transaction counts for the shared TransactionsPanel.
  const [tenantInvoices, resCount, invCount, payCount, staysCount] = await Promise.all([
    prisma.invoice.findMany({
      where:   { tenantId: id, status: { not: "VOID" } },
      orderBy: { issueDate: "desc" },
      take: 50,
    }),
    prisma.reservation.count({ where: { tenantId: id } }),
    prisma.invoice.count({ where: { tenantId: id, status: { not: "VOID" } } }),
    prisma.payment.count({ where: { tenantId: id } }),
    // Actual stays = reservations that reached check-in (in-house or completed).
    prisma.reservation.count({ where: { tenantId: id, status: { in: ["CHECKED_IN", "COMPLETED"] } } }),
  ]);

  // The current in-house stay (for the header link).
  const currentRes = tenant.reservations.find((r) => r.status === "CHECKED_IN") ?? null;

  // Tenant balance = total charged on non-cancelled invoices − total paid (net
  // of refunds). Allowed to go negative so customer credits (overpayments not
  // yet applied to a future invoice) display as e.g. "-10.000 OMR".
  const [chargedAgg, paidAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where:  { tenantId: id, status: { notIn: ["CANCELLED", "VOID"] } },
      _sum:   { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where:  { tenantId: id, isRefund: false },
      _sum:   { amount: true },
    }),
  ]);
  const refundsAgg = await prisma.payment.aggregate({
    where:  { tenantId: id, isRefund: true },
    _sum:   { amount: true },
  });
  const totalCharged  = Number(chargedAgg._sum.totalAmount ?? 0);
  const totalPaid     = Number(paidAgg._sum.amount ?? 0);
  const totalRefunded = Number(refundsAgg._sum.amount ?? 0);
  const openBalance   = Math.round((totalCharged - totalPaid + totalRefunded) * 1000) / 1000;
  // Live "Total Spent" = net amount actually paid (refunds excluded). Replaces
  // the stale denormalized Tenant.totalSpent column which was never populated.
  const totalSpentLive = Math.max(0, Math.round((totalPaid - totalRefunded) * 1000) / 1000);

  const isIdExpired = tenant.idExpiryDate && new Date(tenant.idExpiryDate) < new Date();

  // Serialized transaction data for the shared panel (Reservations/Invoices/Payments).
  const txnData: TransactionData = {
    currency: "OMR",
    counts: { reservations: resCount, invoices: invCount, payments: payCount },
    reservations: tenant.reservations.map((r) => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      status: r.status,
      displayStatus: getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate).label,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      unitLabel:
        r.reservationUnits.map((ru) => ru.unit.name).join(", ") || r.unit?.name || null,
      grandTotal: Number(r.grandTotal ?? 0),
    })),
    invoices: tenantInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      dueDate: i.dueDate.toISOString(),
      issueDate: i.issueDate?.toISOString() ?? null,
      totalAmount: Number(i.totalAmount),
      amountPaid: Number(i.amountPaid),
      balanceDue: Number(i.balanceDue),
      reservationId: i.reservationId,
    })),
    payments: tenant.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      date: p.date.toISOString(),
      reference: p.reference,
      isRefund: p.isRefund,
      reservationId: p.reservationId,
      reservationNumber: p.reservation?.reservationNumber ?? null,
    })),
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

      {/* Back nav */}
      <div className="mb-4">
        <Link href="/dashboard/tenants" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" /> {t("back")}
        </Link>
      </div>

      {/* ── Header ── */}
      <div className="md:flex md:items-start md:justify-between mb-6 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-blue-700">
              {tenant.firstName[0]}{tenant.lastName[0]}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {tenant.firstName} {tenant.lastName}
              </h1>
              {tenant.classification === "vip" && (
                <Badge {...getTenantClassBadge("vip")} size="md">
                  {tCls("vipFull")}
                </Badge>
              )}
              {tenant.classification === "blacklisted" && (
                <Badge {...getTenantClassBadge("blacklisted")} size="md">
                  {tCls("blacklisted")}
                </Badge>
              )}
              {!tenant.isActive && (
                <Badge tone="neutral" appearance="subtle" size="md">
                  {t("inactive")}
                </Badge>
              )}
            </div>
            {tenant.fullNameArabic && (
              <p className="text-lg text-gray-500 mt-0.5" dir="rtl">{tenant.fullNameArabic}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span>
                {tryT(tTypes, tenant.tenantType) ?? "—"}
              </span>
              <span>•</span>
              <span>{t("since", { date: fmtMonY(tenant.createdAt) })}</span>
              {tenant.nationality && (
                <>
                  <span>•</span>
                  <span>{tenant.nationality}</span>
                </>
              )}
            </div>
            {/* Tags */}
            {tenant.tags && tenant.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tenant.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2 md:mt-0 flex-shrink-0">
          <Link
            href="/dashboard/tenants"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <ListBulletIcon className="h-4 w-4 text-gray-400" />
            {t("tenantsList")}
          </Link>
          {canEditTenant && (
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilSquareIcon className="h-4 w-4 text-gray-400" />
            {t("editProfile")}
          </Link>
          )}
          <Link
            href={`/dashboard/reservations/new?tenantId=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PlusIcon className="h-4 w-4 text-gray-400" />
            {t("newReservation")}
          </Link>
          <Link
            href={`/dashboard/payments/new?tenantId=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <BanknotesIcon className="h-4 w-4 text-blue-100" />
            {t("acceptPayment")}
          </Link>
        </div>
      </div>

      {/* Blacklisted warning */}
      {tenant.classification === "blacklisted" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{t("blacklistTitle")}</p>
            {tenant.internalNotes && (
              <p className="text-sm text-red-700 mt-0.5">{tenant.internalNotes}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab navigation ── */}
      <div className="mb-6">
        <TenantDetailTabs
          currentTab={tab}
          labels={{ overview: tTabs("overview"), ledger: tTabs("ledger") }}
        />
      </div>

      {/* ── Financial Ledger tab ── */}
      {tab === "ledger" && (
        <TenantLedger
          tenantId={id}
          tenantName={`${tenant.firstName} ${tenant.lastName}`}
        />
      )}

      {/* ── Overview tab ── */}
      {tab !== "ledger" && (
      <>

      {/* ── KPI Row ── */}
      {currentRes && (
        <Link
          href={`/dashboard/reservations/${currentRes.id}`}
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50/70 px-4 py-3 transition-colors hover:bg-green-50"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-800">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {t("currentlyStaying")}
            {currentRes.reservationNumber ? <span className="font-normal text-green-700 ltr-numbers">· {currentRes.reservationNumber}</span> : null}
          </span>
          <span className="text-sm font-medium text-green-700">{t("viewReservation")} →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className={`bg-white rounded-lg shadow-sm p-4 border-s-4 ${
          openBalance > 0 ? "border-red-400"
          : openBalance < 0 ? "border-blue-400"
          : "border-green-400"
        }`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tKpi("openBalance")}</p>
          <p className={`text-xl font-bold mt-1 ltr-numbers ${
            openBalance > 0 ? "text-red-600"
            : openBalance < 0 ? "text-blue-700"
            : "text-green-700"
          }`}>
            {openBalance.toFixed(3)} OMR
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-blue-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tKpi("totalStays")}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">{staysCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-purple-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tKpi("totalSpent")}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">{totalSpentLive.toFixed(3)} OMR</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-gray-300">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tKpi("source")}</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{tryT(tSrc, tenant.source) ?? "—"}</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Info cards */}
        <div className="lg:col-span-1 space-y-4">

          {/* Contact */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{tSections("contact")}</h3>
            </div>
            <dl className="px-4 divide-y divide-gray-100">
              <InfoRow label={tFields("phone")} value={tenant.phone} />
              <InfoRow label={tFields("secondary")} value={tenant.phoneSecondary} />
              <InfoRow label={tFields("whatsapp")} value={tenant.whatsappNumber} />
              <InfoRow label={tFields("email")} value={tenant.email} />
            </dl>
          </div>

          {/* Identification */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <IdentificationIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{tSections("identification")}</h3>
            </div>
            <dl className="px-4 divide-y divide-gray-100">
              <InfoRow label={tFields("idType")} value={tryT(tIdTypes, tenant.idType)} />
              <InfoRow label={tFields("idNumber")} value={tenant.idNumber} />
              {tenant.idExpiryDate && (
                <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500">{tFields("expiry")}</dt>
                  <dd className={`mt-1 text-sm sm:col-span-2 sm:mt-0 flex items-center gap-1.5 ${isIdExpired ? "text-red-600 font-medium" : "text-gray-900"}`}>
                    <span className="ltr-numbers">{fmtDate(tenant.idExpiryDate)}</span>
                    {isIdExpired && <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />}
                  </dd>
                </div>
              )}
              <InfoRow label={tFields("gender")} value={tenant.gender ? (tenant.gender === "M" ? tGen("male") : tenant.gender === "F" ? tGen("female") : tenant.gender) : null} />
              <InfoRow label={tFields("dateOfBirth")} value={tenant.dateOfBirth ? fmtDate(tenant.dateOfBirth) : null} />
            </dl>
            {/* ID document photos */}
            {(tenant.idDocumentFront || tenant.idDocumentBack) && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-3">
                {tenant.idDocumentFront && (
                  <a href={tenant.idDocumentFront} target="_blank" rel="noopener noreferrer">
                    <Image src={tenant.idDocumentFront} alt="ID Front" width={80} height={50} className="rounded object-cover ring-1 ring-gray-200" />
                  </a>
                )}
                {tenant.idDocumentBack && (
                  <a href={tenant.idDocumentBack} target="_blank" rel="noopener noreferrer">
                    <Image src={tenant.idDocumentBack} alt="ID Back" width={80} height={50} className="rounded object-cover ring-1 ring-gray-200" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Address */}
          {(tenant.country || tenant.city || tenant.addressLine) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <MapPinIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">{tSections("address")}</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label={tFields("country")} value={tenant.country} />
                <InfoRow label={tFields("city")} value={tenant.city} />
                <InfoRow label={tFields("address")} value={tenant.addressLine} />
              </dl>
            </div>
          )}

          {/* Emergency Contact */}
          {(tenant.emergencyContactName || tenant.emergencyContactPhone) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">{tSections("emergency")}</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label={tFields("name")} value={tenant.emergencyContactName} />
                <InfoRow label={tFields("phone")} value={tenant.emergencyContactPhone} />
                <InfoRow label={tFields("relation")} value={tenant.emergencyContactRelation} />
              </dl>
            </div>
          )}

          {/* Corporate */}
          {(tenant.tenantType === "corporate" || tenant.tenantType === "government") && tenant.corporateName && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">{tSections("organisation")}</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label={tFields("company")} value={tenant.corporateName} />
                <InfoRow label={tFields("contact")} value={tenant.corporateContact} />
              </dl>
            </div>
          )}

          {/* Preferences */}
          {(tenant.preferredFloor || tenant.preferredUnitType || tenant.preferredPaymentMethod || tenant.specialRequests) && (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">{tSections("preferences")}</h3>
              </div>
              <dl className="px-4 divide-y divide-gray-100">
                <InfoRow label={tFields("floor")} value={tenant.preferredFloor} />
                <InfoRow label={tFields("unitType")} value={tenant.preferredUnitType} />
                <InfoRow label={tFields("payment")} value={tryT(tPay, tenant.preferredPaymentMethod)} />
                <InfoRow label={tFields("requests")} value={tenant.specialRequests} />
              </dl>
            </div>
          )}

          {/* Internal notes */}
          {tenant.internalNotes && tenant.classification !== "blacklisted" && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 uppercase mb-1">{tSections("internalNotes")}</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{tenant.internalNotes}</p>
            </div>
          )}
        </div>

        {/* RIGHT: Transactions (Reservations · Invoices · Payments) */}
        <div className="lg:col-span-2">
          <TransactionsPanel data={txnData} />
        </div>
      </div>

      </> // end overview tab
      )}

    </div>
  );
}
