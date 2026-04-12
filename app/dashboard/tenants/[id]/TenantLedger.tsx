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
    day: "numeric", month: "short", year: "numeric",
  });
}

function typeBadge(type: "invoice" | "payment" | "return") {
  if (type === "invoice") return "bg-blue-100 text-blue-800";
  if (type === "payment") return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-700";
}

function typeLabel(type: "invoice" | "payment" | "return") {
  if (type === "invoice") return "Invoice";
  if (type === "payment") return "Payment";
  return "Return";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TenantLedger({ tenantId, tenantName }: Props) {
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [summary, setSummary]           = useState<LedgerSummary | null>(null);
  const [loading, setLoading]           = useState(true);

  // Client-side filters
  const [typeFilter, setTypeFilter]     = useState<"all" | "invoices" | "payments" | "returns">("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────
  async function fetchLedger() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/tenants/${tenantId}/ledger`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load ledger");
        return;
      }
      setTransactions(data.transactions ?? []);
      setSummary(data.summary ?? null);
    } catch {
      toast.error("Network error loading ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLedger(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side filtering ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = transactions;

    if (typeFilter !== "all") {
      const typeMap = { invoices: "invoice", payments: "payment", returns: "return" } as const;
      rows = rows.filter((r) => r.type === typeMap[typeFilter]);
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

  // Footer totals
  const footerTotals = useMemo(() => {
    const charges  = filtered.filter((r) => r.type === "invoice").reduce((s, r) => s + r.debit, 0);
    const paid     = filtered.filter((r) => r.type === "payment").reduce((s, r) => s + r.credit, 0);
    const returned = filtered.filter((r) => r.type === "return").reduce((s, r) => s + r.debit, 0);
    return { charges, paid, returned };
  }, [filtered]);

  // Final balance from the last entry in original (unfiltered, not reversed) order
  const finalBalance = summary?.currentBalance ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Summary Card ── */}
      {summary && (
        <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BanknotesIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Financial Summary / الملخص المالي</h3>
            </div>
            <button
              onClick={fetchLedger}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Refresh"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Charged</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{summary.totalCharged.toFixed(3)}</p>
                <p className="text-xs text-gray-400">{summary.invoiceCount} invoice{summary.invoiceCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Paid</p>
                <p className="text-lg font-bold text-green-700 mt-1">{summary.totalPaid.toFixed(3)}</p>
                <p className="text-xs text-gray-400">{summary.paymentCount} payment{summary.paymentCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Returned</p>
                <p className="text-lg font-bold text-red-600 mt-1">{summary.totalReturned.toFixed(3)}</p>
              </div>
              <div className={`rounded-lg p-3 border-2 ${finalBalance > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Balance</p>
                <p className={`text-xl font-bold mt-1 ${finalBalance > 0 ? "text-red-700" : "text-green-700"}`}>
                  {finalBalance.toFixed(3)} OMR
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/dashboard/payments/new?tenantId=${tenantId}`}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                <BanknotesIcon className="h-4 w-4" />
                Record Payment
              </Link>
              <a
                href={`/api/tenants/${tenantId}/ledger/export-excel`}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export CSV
              </a>
              <a
                href={`/api/tenants/${tenantId}/ledger/export-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <PrinterIcon className="h-4 w-4" />
                Print Statement
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 px-4 py-3 flex flex-wrap items-center gap-4">
        {/* Type filter */}
        <div className="flex items-center gap-1">
          {(["all", "invoices", "payments", "returns"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                typeFilter === t
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <label className="text-xs text-gray-500">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Ledger Table ── */}
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading ledger…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No transactions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Debit</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Credit</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm text-gray-600">
                      {fmtDate(row.date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeBadge(row.type)}`}>
                        {typeLabel(row.type)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 max-w-xs">
                      <Link
                        href={
                          row.type === "invoice"
                            ? `/dashboard/invoices/${row.referenceId}`
                            : `/dashboard/payments/${row.referenceId}`
                        }
                        className="hover:text-blue-600 hover:underline"
                      >
                        {row.description}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                      {row.debit > 0 ? (
                        <span className="font-semibold text-red-600">{row.debit.toFixed(3)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                      {row.credit > 0 ? (
                        <span className="font-semibold text-green-700">{row.credit.toFixed(3)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right font-semibold">
                      <span className={row.runningBalance > 0 ? "text-red-600" : "text-green-700"}>
                        {row.runningBalance.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="py-3 pl-4 text-sm font-semibold text-gray-700">
                    Totals ({filtered.length} entries)
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-red-600">
                    {footerTotals.charges.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-green-700">
                    {footerTotals.paid.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold">
                    <span className={finalBalance > 0 ? "text-red-600" : "text-green-700"}>
                      {finalBalance.toFixed(3)} OMR
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
