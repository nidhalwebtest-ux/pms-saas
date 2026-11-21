import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  UserIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArrowUturnLeftIcon,
  ArrowLeftIcon,
  ListBulletIcon,
  BanknotesIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { assertView } from "@/lib/access";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import {
  Badge,
  getReturnStatusBadge,
  returnStatusKey,
} from "@/components/ui";
import ReturnActions from "./ReturnActions";
import ShareButton from "@/components/dashboard/ShareButton";

export default async function ReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await assertView("returns");
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const openRefund = sp.action === "refund";

  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      tenant: true,
      reservation: {
        include: { reservationUnits: { include: { unit: true } } },
      },
      invoice: { select: { id: true, invoiceNumber: true } },
      lineItems: { orderBy: { createdAt: "asc" } },
      createdBy:          { select: { firstName: true, lastName: true } },
      refundProcessedBy:  { select: { firstName: true, lastName: true } },
    },
  });

  if (!ret || ret.organizationId !== orgUser.organizationId) notFound();

  // Building scope: a restricted user may only open a return whose reservation
  // touches one of their assigned buildings (null accessible = unrestricted).
  const accessible = await getSessionAccessibleProperties();
  if (accessible) {
    const propIds = (ret.reservation?.reservationUnits ?? [])
      .map((ru) => ru.unit?.propertyId)
      .filter((p): p is string => !!p);
    if (!propIds.some((pid) => accessible.includes(pid))) redirect("/dashboard/no-access");
  }

  const locale  = await getLocale();
  const dfLoc   = locale === "ar" ? arLocale : enLocale;
  const t       = await getTranslations("returns");
  const tPrint  = await getTranslations("returns.print");
  const tDet    = await getTranslations("returns.detail");
  const tStatus = await getTranslations("returns.statuses");
  const tType   = await getTranslations("returns.types");

  const fmtDate = (d: Date | string) => format(new Date(d), "d MMM yyyy", { locale: dfLoc });

  const returnAmount = Number(ret.returnAmount);
  const refundAmount = Number(ret.refundAmount);
  const badgeKey     = returnStatusKey(ret.status, ret.refundStatus);
  const canRefund    = ret.status !== "cancelled" && ret.refundRequired && ret.refundStatus === "PENDING";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/returns" className="flex items-center gap-1 hover:text-gray-900 transition-colors">
          <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          {tDet("breadcrumb")}
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-900 ltr-numbers">{ret.returnNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ArrowUturnLeftIcon className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono ltr-numbers">{ret.returnNumber}</h1>
              <Badge {...getReturnStatusBadge(badgeKey)} size="md">{tStatus(badgeKey)}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {tType(ret.returnType === "MONTHLY" ? "monthly" : "daily")}
              {" · "}
              {fmtDate(ret.returnFrom)} – {fmtDate(ret.returnTo)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/returns/${ret.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <PrinterIcon className="h-4 w-4" />
            {tPrint("downloadPdf")}
          </a>
          <ShareButton type="return" id={ret.id} />
          <Link
            href="/dashboard/returns"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ListBulletIcon className="h-4 w-4" />
            {tDet("backToList")}
          </Link>
        </div>
      </div>

      {/* Refund action */}
      {canRefund && (
        <ReturnActions returnId={ret.id} refundAmount={refundAmount} openRefundPanel={openRefund} />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return details */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{tDet("returnDetails")}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("type")}</dt>
                <dd className="mt-1 text-gray-900">{tType(ret.returnType === "MONTHLY" ? "monthly" : "daily")}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("period")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">{fmtDate(ret.returnFrom)} – {fmtDate(ret.returnTo)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("quantity")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">
                  {ret.returnType === "MONTHLY" ? tDet("months", { n: ret.returnDays }) : tDet("nights", { n: ret.returnDays })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("created")}</dt>
                <dd className="mt-1 text-gray-900 ltr-numbers">{fmtDate(ret.createdAt)}</dd>
              </div>
              {ret.createdBy && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("createdBy")}</dt>
                  <dd className="mt-1 text-gray-900">{ret.createdBy.firstName} {ret.createdBy.lastName}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
              <p className="text-xs text-gray-500">{tDet("reason")} <span className="text-gray-800">{ret.reason}</span></p>
              {ret.notes && <p className="text-xs text-gray-500">{tDet("notes")} <span className="text-gray-700">{ret.notes}</span></p>}
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{tDet("lineItems")}</h2>
            </div>
            <div className="overflow-x-auto">
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
                {ret.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-3 ps-5 pe-3 text-sm text-gray-900 font-medium">{li.description}</td>
                    <td className="px-3 py-3 text-sm text-end text-gray-600 ltr-numbers">{Number(li.quantity).toFixed(0)}</td>
                    <td className="px-3 py-3 text-sm text-end text-gray-600 ltr-numbers">{Number(li.unitPrice).toFixed(3)} OMR</td>
                    <td className="px-5 py-3 text-sm text-end font-semibold text-gray-900 ltr-numbers">{Number(li.lineTotal).toFixed(3)} OMR</td>
                  </tr>
                ))}
                {ret.lineItems.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400">{tDet("noLineItems")}</td></tr>
                )}
              </tbody>
            </table>
            </div>
            {/* Totals */}
            <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-900 font-bold text-base">
                  <dt>{tDet("returnTotal")}</dt>
                  <dd className="ltr-numbers">{returnAmount.toFixed(3)} OMR</dd>
                </div>
                {ret.refundRequired ? (
                  <div className={`flex justify-between font-medium ${ret.refundStatus === "COMPLETED" ? "text-green-700" : "text-amber-700"}`}>
                    <dt>{ret.refundStatus === "COMPLETED" ? tDet("refunded") : tDet("refundDue")}</dt>
                    <dd className="ltr-numbers">{refundAmount.toFixed(3)} OMR</dd>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-500">
                    <dt>{tDet("refund")}</dt>
                    <dd>{tDet("noRefund")}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Refund info */}
          {ret.refundRequired && (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <BanknotesIcon className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-900">{tDet("refundInfo")}</h2>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 p-5">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundStatus")}</dt>
                  <dd className="mt-1">
                    <Badge {...getReturnStatusBadge(badgeKey)} size="sm">{tStatus(badgeKey)}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundAmount")}</dt>
                  <dd className="mt-1 text-gray-900 ltr-numbers">{refundAmount.toFixed(3)} OMR</dd>
                </div>
                {ret.refundMethod && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundMethod")}</dt>
                    <dd className="mt-1 text-gray-900 capitalize">{ret.refundMethod.toLowerCase().replace("_", " ")}</dd>
                  </div>
                )}
                {ret.refundReference && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundReference")}</dt>
                    <dd className="mt-1 text-gray-900 ltr-numbers">{ret.refundReference}</dd>
                  </div>
                )}
                {ret.refundDate && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundDate")}</dt>
                    <dd className="mt-1 text-gray-900 ltr-numbers">{fmtDate(ret.refundDate)}</dd>
                  </div>
                )}
                {ret.refundProcessedBy && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{tDet("refundProcessedBy")}</dt>
                    <dd className="mt-1 text-gray-900">{ret.refundProcessedBy.firstName} {ret.refundProcessedBy.lastName}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Right (1/3) */}
        <div className="space-y-4">
          {/* Tenant */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("tenant")}</h3>
            </div>
            <Link href={`/dashboard/tenants/${ret.tenantId}`} className="font-semibold text-gray-900 hover:text-purple-600 transition-colors">
              {ret.tenant.firstName} {ret.tenant.lastName}
            </Link>
            <p className="text-sm text-gray-600 mt-1 ltr-numbers">{ret.tenant.phone}</p>
          </div>

          {/* Reservation */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("reservation")}</h3>
            </div>
            <Link href={`/dashboard/reservations/${ret.reservationId}`} className="font-mono font-semibold text-purple-600 hover:text-purple-900 transition-colors ltr-numbers">
              {ret.reservation?.reservationNumber ?? tDet("viewReservation")}
            </Link>
            {ret.reservation && (
              <p className="text-sm text-gray-600 mt-1 ltr-numbers">
                {fmtDate(ret.reservation.startDate)} – {fmtDate(ret.reservation.endDate)}
              </p>
            )}
            {ret.reservation && ret.reservation.reservationUnits.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {ret.reservation.reservationUnits.map((ru) => (
                  <p key={ru.id} className="text-xs text-gray-500">
                    {tDet("unitLabel")}: <span className="font-medium text-gray-700">{ru.unit.name}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Applied invoice */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tDet("appliedInvoice")}</h3>
            </div>
            {ret.invoice ? (
              <Link href={`/dashboard/invoices/${ret.invoice.id}`} className="font-mono font-semibold text-purple-600 hover:text-purple-900 transition-colors ltr-numbers">
                {ret.invoice.invoiceNumber}
              </Link>
            ) : (
              <p className="text-sm text-gray-400">{tDet("noInvoice")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
