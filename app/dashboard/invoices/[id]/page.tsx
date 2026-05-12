import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  UserIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import InvoiceActions from "./InvoiceActions";
import { Badge, resolveInvoiceBadge } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PriceSegment {
  days?: number;
  nights?: number;
  label: string;
  rate?: number;
  subtotal: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type StatusT = (key: string) => string;

function StatusBadge({
  status,
  dueDate,
  t,
}: {
  status: string;
  dueDate: Date;
  t: StatusT;
}) {
  const { props, key } = resolveInvoiceBadge(status, dueDate);
  const labelKey =
    key === "overdue"        ? "overdue" :
    key === "draft"          ? "draft" :
    key === "pending"        ? (status === "PENDING" ? "pending" : "issued") :
    key === "partially-paid" ? "partiallyPaid" :
    key === "paid"           ? "paid" :
    key === "returned"       ? "returned" :
                               "cancelled";
  return (
    <Badge {...props} size="md">
      {t(labelKey)}
    </Badge>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const openPayment = sp.action === "payment";

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: {
        include: {
          reservationUnits: {
            include: { unit: true },
          },
        },
      },
      property: true,
      lineItems: {
        include: { unit: true },
        orderBy: { sortOrder: "asc" },
      },
      allocations: {
        include: {
          payment: {
            select: {
              id: true,
              date: true,
              method: true,
              reference: true,
              amount: true,
              isRefund: true,
              paymentNumber: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!invoice || invoice.organizationId !== orgUser.organizationId) {
    notFound();
  }

  // ── i18n ──────────────────────────────────────────────────────────────────────
  const locale  = await getLocale();
  const dfLoc   = locale === "ar" ? arLocale : enLocale;
  const t       = await getTranslations("invoices");
  const tStatus = await getTranslations("invoices.statuses");
  const tDet    = await getTranslations("invoices.detail");
  const tType   = await getTranslations("invoices.types");
  const tMethod = await getTranslations("invoices.paymentMethods");

  const fmtDate = (d: Date | string) =>
    format(new Date(d), "d MMM yyyy", { locale: dfLoc });

  const tryT = (fn: (k: string) => string, key: string, fallback?: string): string => {
    try { return fn(key); } catch { return fallback ?? key; }
  };

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid  = Number(invoice.amountPaid);
  const balanceDue  = Number(invoice.balanceDue);
  const subtotal    = Number(invoice.subtotal);
  const discount    = Number(invoice.discountAmount);
  const tax         = Number(invoice.taxAmount);

  const typeLabelKey: Record<string, string> = {
    SHORT_TERM: "shortTerm",
    MONTHLY:    "monthly",
    OVERSTAY:   "overstay",
    ADDITIONAL: "additional",
  };
  const typeLabel = (val: string) => {
    const k = typeLabelKey[val];
    return k ? tryT(tType, k, val) : val;
  };

  const methodLabel = (m: string) => tryT(tMethod, m, m.toLowerCase().replace("_", " "));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/invoices" className="flex items-center gap-1 hover:text-gray-900 transition-colors">
          <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          {tDet("breadcrumb")}
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-900 ltr-numbers">{invoice.invoiceNumber}</span>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DocumentTextIcon className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono ltr-numbers">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} dueDate={invoice.dueDate} t={tStatus} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {typeLabel(invoice.invoiceType)}
              {invoice.monthNumber ? ` · ${tDet("monthN", { n: invoice.monthNumber })}` : ""}
              {" · "}
              {tDet("dueLabel", { date: fmtDate(invoice.dueDate) })}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ListBulletIcon className="h-4 w-4" />
          {tDet("backToList")}
        </Link>
      </div>

      {/* Action buttons (client component) */}
      <InvoiceActions
        invoiceId={invoice.id}
        status={invoice.status}
        balanceDue={balanceDue}
        openPaymentPanel={openPayment}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Invoice Info card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{tDet("invoiceDetails")}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("type")}</dt>
                <dd className="mt-1 text-gray-900">{typeLabel(invoice.invoiceType)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("period")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">
                  {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("issueDate")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">{fmtDate(invoice.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("dueDate")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">{fmtDate(invoice.dueDate)}</dd>
              </div>
              {invoice.createdBy && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("createdBy")}</dt>
                  <dd className="mt-1 text-gray-900">
                    {invoice.createdBy.firstName} {invoice.createdBy.lastName}
                  </dd>
                </div>
              )}
              {invoice.cancelledAt && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("cancelledAt")}</dt>
                  <dd className="mt-1 text-red-600 ltr-numbers">{fmtDate(invoice.cancelledAt)}</dd>
                </div>
              )}
            </dl>
            {invoice.cancelledReason && (
              <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-md px-3 py-2">
                {tDet("cancellationReason", { reason: invoice.cancelledReason })}
              </p>
            )}
          </div>

          {/* Line Items table */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{tDet("lineItems")}</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2.5 ps-5 pe-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("description")}</th>
                  <th className="px-3 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 w-16">{tDet("qty")}</th>
                  <th className="px-3 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">{tDet("unitPrice")}</th>
                  <th className="px-5 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 w-32">{tDet("lineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {invoice.lineItems.map((item) => {
                  const breakdown = item.priceBreakdown as PriceSegment[] | null;
                  return (
                    <>
                      <tr key={item.id}>
                        <td className="py-3 ps-5 pe-3 text-sm text-gray-900">
                          <div className="font-medium">
                            {item.unit ? `${item.unit.name} — ` : ""}{item.description}
                          </div>
                          {item.seasonalPriceName && (
                            <div className="text-xs text-indigo-600 mt-0.5">{item.seasonalPriceName}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-end text-gray-600 ltr-numbers">
                          {breakdown ? "—" : Number(item.quantity).toFixed(0)}
                        </td>
                        <td className="px-3 py-3 text-sm text-end text-gray-600 ltr-numbers">
                          {breakdown ? "—" : `${Number(item.unitPrice).toFixed(3)} OMR`}
                        </td>
                        <td className="px-5 py-3 text-sm text-end font-semibold text-gray-900 ltr-numbers">
                          {Number(item.lineTotal).toFixed(3)} OMR
                        </td>
                      </tr>
                      {breakdown && breakdown.map((seg, si) => (
                        <tr key={`${item.id}-seg-${si}`} className="bg-gray-50/60">
                          <td className="py-1.5 ps-9 pe-3 text-xs text-gray-500">
                            <span className="text-gray-400 me-1.5">└</span>
                            {seg.label}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-end text-gray-500 ltr-numbers">
                            {seg.days ?? seg.nights ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-end text-gray-500 ltr-numbers">
                            {seg.rate !== undefined ? `${Number(seg.rate).toFixed(3)} OMR` : "—"}
                          </td>
                          <td className="px-5 py-1.5 text-xs text-end text-gray-600 font-medium ltr-numbers">
                            {Number(seg.subtotal).toFixed(3)} OMR
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
                {invoice.lineItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                      {tDet("noLineItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <dt>{tDet("subtotal")}</dt>
                  <dd className="ltr-numbers">{subtotal.toFixed(3)} OMR</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <dt>{tDet("discount")}</dt>
                    <dd className="ltr-numbers">−{discount.toFixed(3)} OMR</dd>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <dt>{tDet("tax")}</dt>
                    <dd className="ltr-numbers">{tax.toFixed(3)} OMR</dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-900 font-bold text-base pt-1.5 border-t border-gray-200">
                  <dt>{tDet("grandTotal")}</dt>
                  <dd className="ltr-numbers">{totalAmount.toFixed(3)} OMR</dd>
                </div>
                <div className="flex justify-between text-green-700 font-medium pt-1">
                  <dt>{tDet("amountPaid")}</dt>
                  <dd className="ltr-numbers">−{amountPaid.toFixed(3)} OMR</dd>
                </div>
                <div className={`flex justify-between font-bold text-base ${balanceDue > 0 ? "text-red-600" : "text-green-700"}`}>
                  <dt>{tDet("balanceDue")}</dt>
                  <dd className="ltr-numbers">{balanceDue.toFixed(3)} OMR</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-900">{tDet("paymentHistory")}</h2>
            </div>
            {invoice.allocations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">{tDet("noPayments")}</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2.5 ps-5 pe-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("paymentDate")}</th>
                    <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("paymentMethod")}</th>
                    <th className="px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("paymentReference")}</th>
                    <th className="px-5 py-2.5 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("paymentAmount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invoice.allocations.map((alloc) => (
                    <tr key={alloc.id} className={alloc.payment.isRefund ? "bg-red-50" : ""}>
                      <td className="py-3 ps-5 pe-3 text-sm text-gray-900 ltr-numbers">
                        {fmtDate(alloc.payment.date)}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                          {methodLabel(alloc.payment.method)}
                        </span>
                        {alloc.payment.isRefund && (
                          <span className="ms-1.5 inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                            {tDet("refund")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 ltr-numbers">
                        {alloc.payment.reference || "—"}
                      </td>
                      <td className={`px-5 py-3 text-sm text-end font-semibold ltr-numbers ${alloc.payment.isRefund ? "text-red-600" : "text-green-600"}`}>
                        {alloc.payment.isRefund ? "−" : "+"}{Number(alloc.amount).toFixed(3)} OMR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right column (1/3) ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Tenant card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("tenant")}</h3>
            </div>
            <Link
              href={`/dashboard/tenants/${invoice.tenantId}`}
              className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {invoice.tenant.firstName} {invoice.tenant.lastName}
            </Link>
            {invoice.tenant.fullNameArabic && (
              <p className="text-sm text-gray-500 mt-0.5 font-arabic">{invoice.tenant.fullNameArabic}</p>
            )}
            <p className="text-sm text-gray-600 mt-1 ltr-numbers">{invoice.tenant.phone}</p>
            {invoice.tenant.email && (
              <p className="text-sm text-gray-500">{invoice.tenant.email}</p>
            )}
            {invoice.tenant.idType && invoice.tenant.idNumber && (
              <p className="text-xs text-gray-400 mt-1.5 capitalize ltr-numbers">
                {invoice.tenant.idType.replace("_", " ")}: {invoice.tenant.idNumber}
              </p>
            )}
          </div>

          {/* Reservation card */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("reservation")}</h3>
            </div>
            {invoice.reservation.reservationNumber && (
              <Link
                href={`/dashboard/reservations/${invoice.reservationId}`}
                className="font-mono font-semibold text-indigo-600 hover:text-indigo-900 transition-colors ltr-numbers"
              >
                {invoice.reservation.reservationNumber}
              </Link>
            )}
            <p className="text-sm text-gray-600 mt-1 ltr-numbers">
              {fmtDate(invoice.reservation.startDate)} – {fmtDate(invoice.reservation.endDate)}
            </p>
            {invoice.reservation.reservationUnits.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {invoice.reservation.reservationUnits.map((ru) => (
                  <p key={ru.id} className="text-xs text-gray-500">
                    {tDet("unitLabel")}: <span className="font-medium text-gray-700">{ru.unit.name}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Property card */}
          {invoice.property && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("property")}</h3>
              </div>
              <Link
                href={`/dashboard/properties/${invoice.propertyId}`}
                className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {invoice.property.name}
              </Link>
              {invoice.property.address && (
                <p className="text-xs text-gray-500 mt-0.5">{invoice.property.address}</p>
              )}
            </div>
          )}

          {/* Notes card */}
          {invoice.notes && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("notes")}</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
