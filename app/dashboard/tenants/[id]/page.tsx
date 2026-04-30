import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  PencilSquareIcon,
  BanknotesIcon,
  PhoneIcon,
  IdentificationIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  StarIcon,
  ShieldExclamationIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
  ListBulletIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar, enGB } from "date-fns/locale";
import TenantLedger from "./TenantLedger";

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
  const tHist     = await getTranslations("tenants.detail.history");
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
          invoices: { include: { payments: true } },
        },
        orderBy: { startDate: "desc" },
      },
      payments: { orderBy: { date: "desc" }, take: 10 },
    },
  });

  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

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

  const isIdExpired = tenant.idExpiryDate && new Date(tenant.idExpiryDate) < new Date();

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
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  <StarIcon className="h-3.5 w-3.5" /> {tCls("vipFull")}
                </span>
              )}
              {tenant.classification === "blacklisted" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  <ShieldExclamationIcon className="h-3.5 w-3.5" /> {tCls("blacklisted")}
                </span>
              )}
              {!tenant.isActive && (
                <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {t("inactive")}
                </span>
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
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <PencilSquareIcon className="h-4 w-4 text-gray-400" />
            {t("editProfile")}
          </Link>
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
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          <Link
            href={`/dashboard/tenants/${id}?tab=overview`}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tTabs("overview")}
          </Link>
          <Link
            href={`/dashboard/tenants/${id}?tab=ledger`}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === "ledger"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tTabs("ledger")}
          </Link>
        </nav>
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
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">{tenant.totalStays ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-s-4 border-purple-400">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tKpi("totalSpent")}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 ltr-numbers">{Number(tenant.totalSpent ?? 0).toFixed(3)} OMR</p>
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

        {/* RIGHT: History */}
        <div className="lg:col-span-2 space-y-4">

          {/* Lease history */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{tSections("leases")}</h3>
              <span className="ms-auto text-xs text-gray-400">{tHist("recordsCount", { count: tenant.reservations.length })}</span>
            </div>
            {tenant.reservations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">{tHist("noLeases")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tenant.reservations.map((res) => (
                  <li key={res.id} className="hover:bg-gray-50 transition-colors">
                    <Link href={`/dashboard/reservations/${res.id}`} className="block px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {res.unit?.name ?? tHist("multipleUnits")}
                            <span className="ms-1 text-gray-500 font-normal">{tHist("inProperty", { property: res.unit?.property.name ?? "—" })}</span>
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                            <CalendarDaysIcon className="h-3.5 w-3.5" />
                            <span className="ltr-numbers">{fmtDate(res.startDate)} → {fmtDate(res.endDate)}</span>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          res.status === "CONFIRMED" || res.status === "CHECKED_IN"
                            ? "bg-green-100 text-green-800"
                            : res.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : res.status === "COMPLETED"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {res.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Payment history */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{tSections("payments")}</h3>
            </div>
            {tenant.payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">{tHist("noPayments")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tenant.payments.map((pay) => (
                  <li key={pay.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 ltr-numbers">
                        {Number(pay.amount).toFixed(3)} OMR
                      </p>
                      <p className="text-xs text-gray-500 ltr-numbers">
                        {fmtDate(pay.date)}
                      </p>
                    </div>
                    <div className="text-end">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {tryT(tPay, pay.method.toLowerCase()) ?? pay.method}
                      </span>
                      {pay.reference && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">{pay.reference}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      </> // end overview tab
      )}

    </div>
  );
}
