"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BanknotesIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  FunnelIcon,
  XMarkIcon,
  ReceiptRefundIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string;
  date: string;
  type: "invoice" | "payment" | "return";
  description: string;
  debit: number;
  credit: number;
  referenceId: string;
  referenceNumber: string;
  reservationId: string | null;
  runningBalance: number;
}

interface LedgerSummary {
  totalCharged: number;
  totalPaid: number;
  totalReturned: number;
  currentBalance: number;
  invoiceCount: number;
  paymentCount: number;
}

interface Props {
  tenantId: string;
  tenantName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtOMR(n: number) {
  return n.toFixed(3);
}

const TYPE_CONFIG = {
  invoice: {
    label: "Invoice",
    labelAr: "فاتورة",
    bg: "bg-blue-100",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  payment: {
    label: "Payment",
    labelAr: "دفعة",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  return: {
    label: "Refund",
    labelAr: "استرداد",
    bg: "bg-amber-100",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
} as const;

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-3 pl-4 pr-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
      <td className="px-3 py-3"><div className="h-5 bg-gray-100 rounded-full w-16" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-gray-100 rounded w-48" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
      <td className="px-3 py-3"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TenantLedger({ tenantId, tenantName }: Props) {
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [summary, setSummary]           = useState<LedgerSummary | null>(null);
  const [loading, setLoading]           = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "invoices" | "payments" | "returns">("all");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  async function fetchLedger() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/ledger`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to load ledger"); return; }
      setTransactions(data.transactions ?? []);
      setSummary(data.summary ?? null);
    } catch {
      toast.error("Network error loading ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLedger(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Counts for filter tabs ──────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:      transactions.length,
    invoices: transactions.filter((r) => r.type === "invoice").length,
    payments: transactions.filter((r) => r.type === "payment").length,
    returns:  transactions.filter((r) => r.type === "return").length,
  }), [transactions]);

  // ── Client-side filtering ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = transactions;
    if (typeFilter !== "all") {
      const map = { invoices: "invoice", payments: "payment", returns: "return" } as const;
      rows = rows.filter((r) => r.type === map[typeFilter]);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      rows = rows.filter((r) => new Date(r.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r.date) <= to);
    }
    return rows;
  }, [transactions, typeFilter, dateFrom, dateTo]);

  const hasFilters = typeFilter !== "all" || dateFrom || dateTo;

  const footerTotals = useMemo(() => ({
    charges:  filtered.filter((r) => r.type === "invoice").reduce((s, r) => s + r.debit, 0),
    paid:     filtered.filter((r) => r.type === "payment").reduce((s, r) => s + r.credit, 0),
    returned: filtered.filter((r) => r.type === "return").reduce((s, r) => s + r.credit, 0),
  }), [filtered]);

  const finalBalance = summary?.currentBalance ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      {(summary || loading) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Charged */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Charged</span>
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-gray-100 rounded animate-pulse w-28 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {fmtOMR(summary!.totalCharged)}
                <span className="text-sm font-medium text-gray-400 ml-1">OMR</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {loading ? "…" : `${summary!.invoiceCount} invoice${summary!.invoiceCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Total Paid */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <ArrowTrendingDownIcon className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</span>
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-gray-100 rounded animate-pulse w-28 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                {fmtOMR(summary!.totalPaid)}
                <span className="text-sm font-medium text-emerald-400 ml-1">OMR</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {loading ? "…" : `${summary!.paymentCount} payment${summary!.paymentCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Total Returned */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <ReceiptRefundIcon className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Returned</span>
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-gray-100 rounded animate-pulse w-28 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {fmtOMR(summary!.totalReturned)}
                <span className="text-sm font-medium text-amber-400 ml-1">OMR</span>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Refunds &amp; returns</p>
          </div>

          {/* Current Balance */}
          <div className={`rounded-xl shadow-sm ring-2 p-5 ${
            finalBalance > 0
              ? "bg-red-50 ring-red-200"
              : "bg-emerald-50 ring-emerald-200"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  finalBalance > 0 ? "bg-red-100" : "bg-emerald-100"
                }`}>
                  <ScaleIcon className={`h-4 w-4 ${finalBalance > 0 ? "text-red-600" : "text-emerald-600"}`} />
                </div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance Due</span>
              </div>
              <button
                onClick={fetchLedger}
                disabled={loading}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {loading ? (
              <div className="h-7 bg-gray-200 rounded animate-pulse w-28 mb-1" />
            ) : (
              <p className={`text-2xl font-bold tabular-nums ${finalBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                {fmtOMR(Math.abs(finalBalance))}
                <span className="text-sm font-medium ml-1 opacity-60">OMR</span>
              </p>
            )}
            <p className={`text-xs mt-1 font-medium ${finalBalance > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {loading ? "…" : finalBalance > 0 ? "Outstanding" : finalBalance < 0 ? "Overpaid / Credit" : "Fully settled"}
            </p>
          </div>
        </div>
      )}

      {/* ── Action Bar ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Type filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "invoices", "payments", "returns"] as const).map((t) => {
            const labels = { all: "All", invoices: "Invoices", payments: "Payments", returns: "Refunds" };
            const countVal = counts[t];
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  typeFilter === t
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {labels[t]}
                <span className={`text-xs font-bold ${typeFilter === t ? "text-blue-200" : "text-gray-400"}`}>
                  {countVal}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Date filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              showFilters || dateFrom || dateTo
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FunnelIcon className="h-3.5 w-3.5" />
            Date Range
            {(dateFrom || dateTo) && (
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            )}
          </button>

          {/* Export buttons */}
          <a
            href={`/api/tenants/${tenantId}/ledger/export-excel`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Excel
          </a>
          <a
            href={`/api/tenants/${tenantId}/ledger/export-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            PDF
          </a>
          <Link
            href={`/dashboard/payments/new?tenantId=${tenantId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <BanknotesIcon className="h-3.5 w-3.5" />
            Record Payment
          </Link>
        </div>
      </div>

      {/* ── Date Range Picker (collapsible) ─────────────────────────────── */}
      {showFilters && (
        <div className="bg-blue-50 rounded-xl ring-1 ring-blue-200 px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-blue-700">Filter by date:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-blue-600 font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-blue-600 font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-red-600 font-semibold transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear dates
            </button>
          )}
          {filtered.length !== transactions.length && (
            <span className="ml-auto text-xs text-blue-500">
              Showing {filtered.length} of {transactions.length} entries
            </span>
          )}
        </div>
      )}

      {/* ── Ledger Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Transaction History
            {hasFilters && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                — {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"} shown
              </span>
            )}
          </h3>
          {hasFilters && (
            <button
              onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}
              className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Charge (Dr)</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment (Cr)</th>
                  <th className="px-3 py-3 pr-5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <DocumentTextIcon className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">No transactions found</p>
            <p className="text-xs text-gray-300 mt-1">
              {hasFilters ? "Try adjusting your filters" : `${tenantName} has no recorded transactions yet`}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="mt-3 text-xs text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-5 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">
                    <span title="Amount charged to tenant">Charge (Dr)</span>
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                    <span title="Amount paid by tenant">Payment (Cr)</span>
                  </th>
                  <th className="px-3 py-3 pr-5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, idx) => {
                  const cfg = TYPE_CONFIG[row.type];
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-gray-50/70 ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap py-3.5 pl-5 pr-3 text-sm text-gray-600">
                        {fmtDate(row.date)}
                      </td>

                      {/* Type badge */}
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Description + ref */}
                      <td className="px-3 py-3.5 text-sm max-w-xs">
                        <Link
                          href={
                            row.type === "invoice"
                              ? `/dashboard/invoices/${row.referenceId}`
                              : `/dashboard/payments/${row.referenceId}`
                          }
                          className="font-medium text-gray-800 hover:text-blue-600 transition-colors"
                        >
                          {row.description}
                        </Link>
                        {row.reservationId && (
                          <Link
                            href={`/dashboard/reservations/${row.reservationId}`}
                            className="block text-xs text-gray-400 hover:text-blue-500 mt-0.5 transition-colors"
                          >
                            View reservation →
                          </Link>
                        )}
                      </td>

                      {/* Debit */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-right">
                        {row.debit > 0 ? (
                          <span className="font-semibold text-red-600 tabular-nums">{fmtOMR(row.debit)}</span>
                        ) : (
                          <span className="text-gray-200 select-none">—</span>
                        )}
                      </td>

                      {/* Credit */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-right">
                        {row.credit > 0 ? (
                          <span className="font-semibold text-emerald-700 tabular-nums">{fmtOMR(row.credit)}</span>
                        ) : (
                          <span className="text-gray-200 select-none">—</span>
                        )}
                      </td>

                      {/* Running balance */}
                      <td className="whitespace-nowrap px-3 py-3.5 pr-5 text-right">
                        <span
                          className={`font-bold tabular-nums text-sm ${
                            row.runningBalance > 0.001
                              ? "text-red-600"
                              : row.runningBalance < -0.001
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {fmtOMR(Math.abs(row.runningBalance))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="py-3.5 pl-5 text-sm font-semibold text-gray-700">
                    Totals — {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm font-bold text-red-600 tabular-nums">
                    {fmtOMR(footerTotals.charges)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm font-bold text-emerald-700 tabular-nums">
                    {fmtOMR(footerTotals.paid)}
                  </td>
                  <td className="px-3 py-3.5 pr-5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <span className={`text-sm font-bold tabular-nums ${finalBalance > 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {fmtOMR(Math.abs(finalBalance))}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">OMR</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Balance indicator note ─────────────────────────────────────────── */}
      {!loading && transactions.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Dr = amount charged to tenant &nbsp;·&nbsp; Cr = amount paid by tenant &nbsp;·&nbsp; Balance = outstanding amount owed
        </p>
      )}
    </div>
  );
}
