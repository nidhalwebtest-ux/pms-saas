import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { Prisma } from "@prisma/client";
import {
  PrinterIcon,
  CreditCardIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { getTranslations, getLocale } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatCurrency } from "@/lib/format-currency";

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusFilter =
  | "ALL"
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "OVERDUE";

const PAGE_SIZE = 20;

// ── Helpers ────────────────────────────────────────────────────────────────────

function isOverdue(status: string, dueDate: Date): boolean {
  return (
    (status === "ISSUED" || status === "PARTIALLY_PAID") &&
    new Date(dueDate) < new Date()
  );
}

type StatusT = (key: string) => string;

function StatusBadge({ status, dueDate, t }: { status: string; dueDate: Date; t: StatusT }) {
  if (isOverdue(status, dueDate)) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
        {t("overdue")}
      </span>
    );
  }
  switch (status) {
    case "DRAFT":
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/20">
          {t("draft")}
        </span>
      );
    case "ISSUED":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/20">
          {t("issued")}
        </span>
      );
    case "PARTIALLY_PAID":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
          {t("partial")}
        </span>
      );
    case "PAID":
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
          {t("paid")}
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-400/20">
          {t("cancelled")}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-400/20">
          {status}
        </span>
      );
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  // Auth
  let orgUser: Awaited<ReturnType<typeof requireOrgUser>>;
  try {
    orgUser = await requireOrgUser();
  } catch {
    redirect("/login");
  }

  const params = await searchParams;
  const statusFilter = (params.status?.toUpperCase() as StatusFilter) || "ALL";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const propertyId = params.propertyId || "";

  const today = new Date();

  // ── i18n ──────────────────────────────────────────────────────────────────────
  const locale  = await getLocale();
  const dfLoc   = locale === "ar" ? arLocale : enLocale;
  const currency = await getCurrentCurrency();
  const t       = await getTranslations("invoices");
  const tStatus = await getTranslations("invoices.statuses");
  const tTabs   = await getTranslations("invoices.tabs");
  const tTbl    = await getTranslations("invoices.table");
  const tPag    = await getTranslations("invoices.pagination");
  const tRow    = await getTranslations("invoices.rowActions");
  const tSearch = await getTranslations("invoices.search");

  const fmtDate = (d: Date | string, fmt = "d MMM yyyy") =>
    format(new Date(d), fmt, { locale: dfLoc });

  // ── Build where clause ────────────────────────────────────────────────────────

  const baseWhere: Prisma.InvoiceWhereInput = {
    organizationId: orgUser.organizationId,
    ...(propertyId && { propertyId }),
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { tenant: { firstName: { contains: search, mode: "insensitive" } } },
        { tenant: { lastName:  { contains: search, mode: "insensitive" } } },
        { reservation: { reservationNumber: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  // For OVERDUE tab we query ISSUED + PARTIALLY_PAID with dueDate < today
  let statusWhere: Prisma.InvoiceWhereInput = {};
  if (statusFilter === "OVERDUE") {
    statusWhere = {
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      dueDate: { lt: today },
    };
  } else if (statusFilter !== "ALL") {
    statusWhere = { status: statusFilter as any };
  }

  const where: Prisma.InvoiceWhereInput = { ...baseWhere, ...statusWhere };

  // ── Fetch data ────────────────────────────────────────────────────────────────

  const [invoices, total, statusCounts] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        tenant: { select: { firstName: true, lastName: true, phone: true } },
        reservation: { select: { reservationNumber: true, startDate: true, endDate: true } },
        property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),

    prisma.invoice.count({ where }),

    // Counts per status tab
    prisma.invoice.groupBy({
      by: ["status"],
      where: {
        organizationId: orgUser.organizationId,
        ...(propertyId && { propertyId }),
      },
      _count: { _all: true },
    }),
  ]);

  // Build count map
  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = row._count._all;
  }
  const allCount = Object.values(countMap).reduce((a, b) => a + b, 0);
  const overdueCount = invoices.length > 0
    ? await prisma.invoice.count({
        where: {
          organizationId: orgUser.organizationId,
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          dueDate: { lt: today },
        },
      })
    : 0;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Tab config ────────────────────────────────────────────────────────────────

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL",            label: tTabs("all"),         count: allCount },
    { key: "ISSUED",         label: tTabs("outstanding"), count: countMap["ISSUED"] ?? 0 },
    { key: "OVERDUE",        label: tTabs("overdue"),     count: overdueCount },
    { key: "PARTIALLY_PAID", label: tTabs("partial"),     count: countMap["PARTIALLY_PAID"] ?? 0 },
    { key: "PAID",           label: tTabs("paid"),        count: countMap["PAID"] ?? 0 },
    { key: "DRAFT",          label: tTabs("draft"),       count: countMap["DRAFT"] ?? 0 },
    { key: "CANCELLED",      label: tTabs("cancelled"),   count: countMap["CANCELLED"] ?? 0 },
  ];

  // ── Build pagination URL helper ───────────────────────────────────────────────

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (statusFilter !== "ALL") sp.set("status", statusFilter);
    if (search) sp.set("search", search);
    if (propertyId) sp.set("propertyId", propertyId);
    sp.set("page", String(p));
    return `/dashboard/invoices?${sp.toString()}`;
  }

  function tabUrl(key: StatusFilter) {
    const sp = new URLSearchParams();
    if (key !== "ALL") sp.set("status", key);
    if (search) sp.set("search", search);
    if (propertyId) sp.set("propertyId", propertyId);
    const qs = sp.toString();
    return `/dashboard/invoices${qs ? `?${qs}` : ""}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <DocumentTextIcon className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("recordsCount", { count: total })}</p>
          </div>
        </div>
        <Link
          href="/dashboard/reservations"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("newInvoice")}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Status tabs">
          {tabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <Link
                key={tab.key}
                href={tabUrl(tab.key)}
                className={`
                  whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ms-2 rounded-full px-2 py-0.5 text-xs font-semibold ltr-numbers ${
                      active
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Search bar */}
      <form method="GET" action="/dashboard/invoices" className="flex gap-2">
        {statusFilter !== "ALL" && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder={tSearch("placeholder")}
            className="w-full rounded-lg border border-gray-300 py-2 ps-9 pe-3 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {tSearch("submit")}
        </button>
        {search && (
          <Link
            href={tabUrl(statusFilter)}
            className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {tSearch("clear")}
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-3 ps-4 pe-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 sm:ps-6">{tTbl("invoiceNumber")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("status")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("tenant")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("reservation")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("period")}</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("total")}</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("paid")}</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("balance")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("dueDate")}</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{tTbl("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-500">
                    {tTbl("empty")}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const overdue = isOverdue(inv.status, inv.dueDate);
                  const balanceDue = Number(inv.balanceDue);
                  const rowClass = overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50";

                  return (
                    <tr key={inv.id} className={`transition-colors ${rowClass}`}>
                      {/* Invoice # */}
                      <td className="whitespace-nowrap py-3.5 ps-4 pe-3 text-sm sm:ps-6">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="font-mono font-semibold text-indigo-600 hover:text-indigo-900 ltr-numbers"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm">
                        <StatusBadge status={inv.status} dueDate={inv.dueDate} t={tStatus} />
                      </td>

                      {/* Tenant */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm">
                        <div className="font-medium text-gray-900">
                          {inv.tenant.firstName} {inv.tenant.lastName}
                        </div>
                        <div className="text-xs text-gray-400 ltr-numbers">{inv.tenant.phone}</div>
                      </td>

                      {/* Reservation */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm">
                        {inv.reservation.reservationNumber ? (
                          <Link
                            href={`/dashboard/reservations/${inv.reservationId}`}
                            className="text-xs text-blue-600 hover:underline font-mono ltr-numbers"
                          >
                            {inv.reservation.reservationNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Period */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs text-gray-500 ltr-numbers">
                        {fmtDate(inv.periodStart, "d MMM")} –{" "}
                        {fmtDate(inv.periodEnd)}
                      </td>

                      {/* Total */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm text-end font-semibold text-gray-900 ltr-numbers">
                        {formatCurrency(inv.totalAmount, currency)}
                      </td>

                      {/* Paid */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm text-end text-green-600 font-medium ltr-numbers">
                        {formatCurrency(inv.amountPaid, currency)}
                      </td>

                      {/* Balance */}
                      <td className={`whitespace-nowrap px-3 py-3.5 text-sm text-end font-semibold ltr-numbers ${balanceDue > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {formatCurrency(balanceDue, currency)}
                      </td>

                      {/* Due Date */}
                      <td className={`whitespace-nowrap px-3 py-3.5 text-xs ltr-numbers ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                        {fmtDate(inv.dueDate)}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm">
                        <div className="flex items-center gap-1.5">
                          {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID" || overdue) && (
                            <Link
                              href={`/dashboard/invoices/${inv.id}?action=payment`}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 ring-1 ring-inset ring-indigo-700/20 transition-colors"
                            >
                              <CreditCardIcon className="h-3 w-3" />
                              {tRow("pay")}
                            </Link>
                          )}
                          {inv.status === "DRAFT" && (
                            <Link
                              href={`/dashboard/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 ring-1 ring-inset ring-amber-600/20 transition-colors"
                            >
                              {tRow("issue")}
                            </Link>
                          )}
                          {inv.status !== "CANCELLED" && inv.status !== "DRAFT" && (
                            <Link
                              href={`/dashboard/invoices/${inv.id}/print`}
                              className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 ring-1 ring-inset ring-gray-500/20 transition-colors"
                            >
                              <PrinterIcon className="h-3 w-3" />
                              {tRow("print")}
                            </Link>
                          )}
                          {inv.status === "CANCELLED" && (
                            <Link
                              href={`/dashboard/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 ring-1 ring-inset ring-gray-400/20 transition-colors"
                            >
                              <EyeIcon className="h-3 w-3" />
                              {tRow("view")}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-6">
            <p className="text-sm text-gray-500">
              {tPag("showing", {
                start: (page - 1) * PAGE_SIZE + 1,
                end: Math.min(page * PAGE_SIZE, total),
                total,
              })}
            </p>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={pageUrl(page - 1)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {tPag("previous")}
                </Link>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <Link
                    key={p}
                    href={pageUrl(p)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ltr-numbers ${
                      p === page
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
              {page < totalPages && (
                <Link
                  href={pageUrl(page + 1)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {tPag("next")}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
