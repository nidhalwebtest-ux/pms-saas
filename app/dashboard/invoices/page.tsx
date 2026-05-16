import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCurrentCurrency } from "@/lib/get-org";
import { formatCurrency } from "@/lib/format-currency";
import InvoicesTable from "./InvoicesTable";
import type { InvoiceRow } from "./columns";

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusFilter =
  | "ALL"
  | "DRAFT"
  | "ISSUED"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "OVERDUE";

const PAGE_SIZE = 20;

// Statuses that count as "outstanding" (issued and waiting for full payment)
const OUTSTANDING_STATUSES = ["ISSUED", "PENDING", "PARTIALLY_PAID"] as const;

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
  const currency = await getCurrentCurrency();
  const t       = await getTranslations("invoices");
  const tTabs   = await getTranslations("invoices.tabs");
  const tSearch = await getTranslations("invoices.search");
  const tFooter = await getTranslations("invoices.footer");

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

  // For OVERDUE tab we query outstanding invoices with dueDate < today
  let statusWhere: Prisma.InvoiceWhereInput = {};
  if (statusFilter === "OVERDUE") {
    statusWhere = {
      status: { in: [...OUTSTANDING_STATUSES] },
      dueDate: { lt: today },
    };
  } else if (statusFilter !== "ALL") {
    statusWhere = { status: statusFilter as any };
  }

  const where: Prisma.InvoiceWhereInput = { ...baseWhere, ...statusWhere };

  // ── Fetch data ────────────────────────────────────────────────────────────────

  const [invoices, total, statusCounts, footerSums, overdueCount] = await Promise.all([
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

    // Counts per status tab (for current filters minus status)
    prisma.invoice.groupBy({
      by: ["status"],
      where: {
        organizationId: orgUser.organizationId,
        ...(propertyId && { propertyId }),
      },
      _count: { _all: true },
    }),

    // Aggregate sums for footer (respects status + search filters)
    prisma.invoice.aggregate({
      where,
      _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
    }),

    // Overdue count is independent of statusFilter so the tab badge is stable
    prisma.invoice.count({
      where: {
        organizationId: orgUser.organizationId,
        ...(propertyId && { propertyId }),
        status: { in: [...OUTSTANDING_STATUSES] },
        dueDate: { lt: today },
      },
    }),
  ]);

  // Build count map
  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = row._count._all;
  }
  const allCount = Object.values(countMap).reduce((a, b) => a + b, 0);
  const outstandingCount =
    (countMap["ISSUED"] ?? 0) + (countMap["PENDING"] ?? 0) + (countMap["PARTIALLY_PAID"] ?? 0);
  const toBeIssuedCount = countMap["DRAFT"] ?? 0;

  const sumTotal   = Number(footerSums._sum.totalAmount  ?? 0);
  const sumPaid    = Number(footerSums._sum.amountPaid   ?? 0);
  const sumBalance = Number(footerSums._sum.balanceDue   ?? 0);

  // Serialize prisma → plain InvoiceRow for the client table. Decimal → number,
  // Date → ISO string. Anything the table does not consume is dropped.
  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    dueDate: inv.dueDate.toISOString(),
    issueDate: inv.issueDate.toISOString(),
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    totalAmount: Number(inv.totalAmount),
    amountPaid: Number(inv.amountPaid),
    balanceDue: Number(inv.balanceDue),
    tenant: {
      firstName: inv.tenant.firstName,
      lastName: inv.tenant.lastName,
      phone: inv.tenant.phone,
    },
    reservation: {
      reservationNumber: inv.reservation.reservationNumber,
    },
    reservationId: inv.reservationId,
  }));

  // ── Tab config ────────────────────────────────────────────────────────────────

  type TabDef = {
    key: StatusFilter;
    label: string;
    count: number;
    tone?: "default" | "warn" | "danger";
  };

  const primaryTabs: TabDef[] = [
    { key: "ALL",           label: tTabs("all"),         count: allCount },
    { key: "DRAFT",         label: tTabs("toBeIssued"),  count: toBeIssuedCount, tone: "warn" },
    { key: "ISSUED",        label: tTabs("outstanding"), count: outstandingCount },
    { key: "OVERDUE",       label: tTabs("overdue"),     count: overdueCount, tone: "danger" },
    { key: "PARTIALLY_PAID",label: tTabs("partial"),     count: countMap["PARTIALLY_PAID"] ?? 0 },
    { key: "PAID",          label: tTabs("paid"),        count: countMap["PAID"] ?? 0 },
    { key: "CANCELLED",     label: tTabs("cancelled"),   count: countMap["CANCELLED"] ?? 0 },
  ];

  // ── Build URL helpers ─────────────────────────────────────────────────────────

  function tabUrl(key: StatusFilter) {
    const sp = new URLSearchParams();
    if (key !== "ALL") sp.set("status", key);
    if (search) sp.set("search", search);
    if (propertyId) sp.set("propertyId", propertyId);
    const qs = sp.toString();
    return `/dashboard/invoices${qs ? `?${qs}` : ""}`;
  }

  // Refresh URL preserves current filters but adds a cache-buster timestamp
  const refreshUrl = (() => {
    const sp = new URLSearchParams();
    if (statusFilter !== "ALL") sp.set("status", statusFilter);
    if (search) sp.set("search", search);
    if (propertyId) sp.set("propertyId", propertyId);
    sp.set("_t", String(Date.now()));
    return `/dashboard/invoices?${sp.toString()}`;
  })();

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">

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
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {t("newInvoice")}
        </Link>
      </div>

      {/* Pill-style filter tabs */}
      <div className="flex flex-wrap gap-1">
        {primaryTabs.map((tab) => {
          const active = statusFilter === tab.key;
          const isWarn   = tab.tone === "warn"   && tab.count > 0;
          const isDanger = tab.tone === "danger" && tab.count > 0;
          return (
            <Link
              key={tab.key}
              href={tabUrl(tab.key)}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ltr-numbers ${
                    active
                      ? "bg-white/25 text-white"
                      : isDanger
                        ? "bg-red-600 text-white animate-pulse"
                        : isWarn
                          ? "bg-amber-500 text-white"
                          : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Search + refresh bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <form method="GET" action="/dashboard/invoices" className="flex flex-1 gap-2">
            {statusFilter !== "ALL" && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder={tSearch("placeholder")}
                className="block w-full rounded-lg border-0 py-2 ps-9 pe-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500"
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
                className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {tSearch("clear")}
              </Link>
            )}
          </form>
          <Link
            href={refreshUrl}
            aria-label={t("refresh")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Table */}
      <InvoicesTable
        invoices={invoiceRows}
        currency={currency}
        pageIndex={page - 1}
        pageSize={PAGE_SIZE}
        totalCount={total}
      />

      {/* Footer totals (table chrome owns rows-per-page + page nav) */}
      {(invoices.length > 0 || total > 0) && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-fg-tertiary">
          <span>
            {tFooter("total")}:{" "}
            <strong className="text-fg ltr-numbers">
              {formatCurrency(sumTotal, currency)}
            </strong>
          </span>
          <span>
            {tFooter("paid")}:{" "}
            <strong className="text-success-700 ltr-numbers">
              {formatCurrency(sumPaid, currency)}
            </strong>
          </span>
          <span>
            {tFooter("balance")}:{" "}
            <strong className={`ltr-numbers ${sumBalance > 0 ? "text-error-600" : "text-fg"}`}>
              {formatCurrency(sumBalance, currency)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
