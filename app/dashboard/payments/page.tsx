import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  BanknotesIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ───────────────────────────────────────────────────────────────────

function methodBadge(method: string) {
  const map: Record<string, string> = {
    CASH: "bg-green-100 text-green-800",
    CARD: "bg-blue-100 text-blue-800",
    BANK_TRANSFER: "bg-purple-100 text-purple-800",
    CHEQUE: "bg-orange-100 text-orange-800",
    ONLINE: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-600",
  };
  return map[method] ?? "bg-gray-100 text-gray-600";
}

function methodLabel(method: string) {
  const map: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    CHEQUE: "Cheque",
    ONLINE: "Online",
    OTHER: "Other",
  };
  return map[method] ?? method;
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q        = params.q      ?? "";
  const method   = params.method ?? "";
  const period   = params.period ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/login");

  const orgId = dbUser.organizationId;

  // ── Date range for period filter ──────────────────────────────────────────
  const now   = new Date();
  const today = startOfDay(now);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  function periodRange(p: string): { gte?: Date; lte?: Date } {
    if (p === "today") return { gte: today, lte: endOfDay(now) };
    if (p === "week")  return { gte: weekStart, lte: endOfDay(now) };
    if (p === "month") return { gte: monthStart, lte: endOfDay(now) };
    return {};
  }

  // ── Tab counts ────────────────────────────────────────────────────────────
  const baseWhere = { organizationId: orgId };
  const [allCount, todayCount, weekCount, monthCount] = await Promise.all([
    prisma.payment.count({ where: baseWhere }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("today") } }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("week") } }),
    prisma.payment.count({ where: { ...baseWhere, date: periodRange("month") } }),
  ]);

  // ── Main query ────────────────────────────────────────────────────────────
  const dateRange = periodRange(period);
  const where: Prisma.PaymentWhereInput = {
    organizationId: orgId,
    ...(dateRange.gte || dateRange.lte ? { date: dateRange } : {}),
    ...(method ? { method: method as Prisma.EnumPaymentMethodFilter } : {}),
    ...(q
      ? {
          OR: [
            { tenant: { firstName: { contains: q, mode: "insensitive" } } },
            { tenant: { lastName:  { contains: q, mode: "insensitive" } } },
            { paymentNumber: { contains: q, mode: "insensitive" } },
            { reference:     { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
      allocations: {
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  // ── Footer totals ─────────────────────────────────────────────────────────
  const totals = { all: 0, CASH: 0, CARD: 0, BANK_TRANSFER: 0, CHEQUE: 0 };
  for (const p of payments) {
    const amt = Number(p.amount);
    totals.all += amt;
    if (p.method === "CASH")          totals.CASH          += amt;
    if (p.method === "CARD")          totals.CARD          += amt;
    if (p.method === "BANK_TRANSFER") totals.BANK_TRANSFER += amt;
    if (p.method === "CHEQUE")        totals.CHEQUE        += amt;
  }

  // ── Tab helper ────────────────────────────────────────────────────────────
  function tabHref(p: string) {
    const sp = new URLSearchParams();
    sp.set("period", p);
    if (q)      sp.set("q",      q);
    if (method) sp.set("method", method);
    return `/dashboard/payments?${sp.toString()}`;
  }

  const tabs = [
    { key: "all",   label: "All",        count: allCount   },
    { key: "today", label: "Today",      count: todayCount },
    { key: "week",  label: "This Week",  count: weekCount  },
    { key: "month", label: "This Month", count: monthCount },
  ];

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-md">
            <BanknotesIcon className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments & Receipts</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {payments.length} records — Total:{" "}
              <span className="font-bold text-green-700">{totals.all.toFixed(3)} OMR</span>
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          + Record Payment
        </Link>
      </div>

      {/* ── Quick-filter tabs ── */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                period === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                period === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {tab.count}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Search & filters ── */}
      <form method="GET" action="/dashboard/payments" className="flex flex-wrap gap-3 mb-4">
        <input type="hidden" name="period" value={period} />
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search tenant, receipt #, reference…"
            className="block w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          name="method"
          defaultValue={method}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHEQUE">Cheque</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Search
        </button>
        {(q || method) && (
          <Link
            href={`/dashboard/payments?period=${period}`}
            className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── Table ── */}
      <div className="flow-root">
        <div className="overflow-x-auto rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Receipt #</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Tenant</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Method</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Reference</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Applied To</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Received By</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-gray-400">
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const receiptNum = payment.paymentNumber ?? payment.id.slice(0, 8).toUpperCase();
                  const appliedTo  = payment.allocations.map((a) => a.invoice.invoiceNumber).join(", ");

                  return (
                    <tr key={payment.id} className="hover:bg-blue-50 transition-colors">
                      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-mono text-gray-700 font-semibold">
                        <Link href={`/dashboard/payments/${payment.id}`} className="text-blue-600 hover:underline">
                          {receiptNum}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">
                        {new Date(payment.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm">
                        <Link href={`/dashboard/tenants/${payment.tenant.id}`} className="font-medium text-blue-600 hover:underline">
                          {payment.tenant.firstName} {payment.tenant.lastName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-right font-bold text-green-700">
                        {Number(payment.amount).toFixed(3)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${methodBadge(payment.method)}`}>
                          {methodLabel(payment.method)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                        {payment.reference || "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 max-w-[180px] truncate">
                        {appliedTo || <span className="italic text-gray-400">Unapplied</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                        {payment.receivedBy
                          ? `${payment.receivedBy.firstName ?? ""} ${payment.receivedBy.lastName ?? ""}`.trim()
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <PrintReceiptButton paymentId={payment.id} />
                          <Link
                            href={`/dashboard/payments/${payment.id}`}
                            className="inline-flex items-center rounded px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {payments.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="py-3 pl-4 text-sm font-semibold text-gray-700">
                    Totals ({payments.length} payments)
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-green-700">
                    {totals.all.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="text-green-700">Cash: {totals.CASH.toFixed(3)}</span>
                      <span className="text-blue-700">Card: {totals.CARD.toFixed(3)}</span>
                      <span className="text-purple-700">Bank: {totals.BANK_TRANSFER.toFixed(3)}</span>
                      <span className="text-orange-700">Cheque: {totals.CHEQUE.toFixed(3)}</span>
                    </div>
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Client-side print button (inline to avoid extra file) ─────────────────────
// Note: This is a server component page, so we use a simple link trick for print.
function PrintReceiptButton({ paymentId }: { paymentId: string }) {
  return (
    <a
      href={`/api/payments/${paymentId}/receipt-pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100"
    >
      <PrinterIcon className="h-3 w-3" />
      Print
    </a>
  );
}
