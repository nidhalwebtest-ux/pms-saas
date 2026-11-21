"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useCan } from "@/components/PermissionsProvider";
import {
  CheckCircleIcon,
  CreditCardIcon,
  EyeIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import {
  DataTable,
  FilterBar,
  NoInvoicesFirstTime,
  NoInvoicesForFilters,
  type QuickFilter,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format-currency";
import {
  buildInvoiceColumns,
  invoiceRowVariant,
  type InvoiceRow,
} from "./columns";

// ── Tabs ─────────────────────────────────────────────────────────────────────

const STATUS_TABS = ["ALL", "DRAFT", "ISSUED", "OVERDUE", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
type StatusTab = typeof STATUS_TABS[number];

const PAGE_SIZE = 20;

// Statuses that count as "outstanding" (issued and waiting for full payment).
const OUTSTANDING_STATUSES = ["ISSUED", "PENDING", "PARTIALLY_PAID"];

/** Day-level overdue: outstanding invoice whose due date is before today. */
function isOverdueRow(row: InvoiceRow, startOfToday: number): boolean {
  if (!OUTSTANDING_STATUSES.includes(row.status)) return false;
  return new Date(row.dueDate).getTime() < startOfToday;
}

export interface InvoicesTableProps {
  invoices: InvoiceRow[];
  currency: string;
}

/**
 * Client wrapper for the invoices list. Holds all filter state (tab + search)
 * locally and filters / paginates the pre-loaded rows in the browser — no DB
 * refetch on tab, search, or page change. Tab counts and footer sums are
 * derived from the loaded rows.
 */
export default function InvoicesTable({ invoices, currency }: InvoicesTableProps) {
  const router = useRouter();
  const canEditInvoice   = useCan("invoices", "CREATE");
  const canRecordPayment = useCan("payments", "CREATE");
  const tTbl    = useTranslations("invoices.table");
  const tStatus = useTranslations("invoices.statuses");
  const tRow    = useTranslations("invoices.rowActions");
  const tTabs   = useTranslations("invoices.tabs");
  const tSearch = useTranslations("invoices.search");
  const tFooter = useTranslations("invoices.footer");
  const locale  = useLocale();

  // ── Filter state (all client-side) ───────────────────────────────────────
  const [tab, setTab]             = useState<StatusTab>("ALL");
  const [search, setSearch]       = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  // Start of today: an invoice due *today* is not overdue yet.
  const startOfToday = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }, []);

  // ── Tab counts (derived from loaded rows) ────────────────────────────────
  const counts = useMemo(() => {
    let all = 0, draft = 0, outstanding = 0, overdue = 0, partial = 0, paid = 0, cancelled = 0;
    for (const r of invoices) {
      all++;
      switch (r.status) {
        case "DRAFT":          draft++; break;
        case "PARTIALLY_PAID": partial++; break;
        case "PAID":           paid++; break;
        case "CANCELLED":      cancelled++; break;
      }
      if (OUTSTANDING_STATUSES.includes(r.status)) outstanding++;
      if (isOverdueRow(r, startOfToday)) overdue++;
    }
    return { ALL: all, DRAFT: draft, ISSUED: outstanding, OVERDUE: overdue, PARTIALLY_PAID: partial, PAID: paid, CANCELLED: cancelled };
  }, [invoices, startOfToday]);

  // ── Filtered rows (tab + search) ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = invoices;
    switch (tab) {
      case "DRAFT":          rows = rows.filter((r) => r.status === "DRAFT"); break;
      case "ISSUED":         rows = rows.filter((r) => OUTSTANDING_STATUSES.includes(r.status)); break;
      case "OVERDUE":        rows = rows.filter((r) => isOverdueRow(r, startOfToday)); break;
      case "PARTIALLY_PAID": rows = rows.filter((r) => r.status === "PARTIALLY_PAID"); break;
      case "PAID":           rows = rows.filter((r) => r.status === "PAID"); break;
      case "CANCELLED":      rows = rows.filter((r) => r.status === "CANCELLED"); break;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        (r.tenant.firstName?.toLowerCase().includes(q) ?? false) ||
        (r.tenant.lastName?.toLowerCase().includes(q) ?? false) ||
        (r.reservation.reservationNumber?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [invoices, tab, search, startOfToday]);

  // ── Footer sums (over filtered rows) ─────────────────────────────────────
  const sums = useMemo(() => {
    let total = 0, paid = 0, balance = 0;
    for (const r of filtered) {
      total   += r.totalAmount;
      paid    += r.amountPaid;
      balance += r.balanceDue;
    }
    return { total, paid, balance };
  }, [filtered]);

  const columns = useMemo(
    () => buildInvoiceColumns({ tTbl, tStatus, currency, locale }),
    [tTbl, tStatus, currency, locale],
  );

  // ── Quick filter tabs ────────────────────────────────────────────────────
  const labelFor = (k: StatusTab): string => {
    switch (k) {
      case "ALL":            return tTabs("all");
      case "DRAFT":          return tTabs("toBeIssued");
      case "ISSUED":         return tTabs("outstanding");
      case "OVERDUE":        return tTabs("overdue");
      case "PARTIALLY_PAID": return tTabs("partial");
      case "PAID":           return tTabs("paid");
      case "CANCELLED":      return tTabs("cancelled");
    }
  };
  const variantFor = (k: StatusTab): QuickFilter["variant"] => {
    if (k === "OVERDUE") return "destructive";
    if (k === "DRAFT")   return "warning";
    if (k === "PAID")    return "success";
    return undefined;
  };
  const quickFilters: QuickFilter[] = STATUS_TABS.map((k) => ({
    id:      k,
    label:   labelFor(k),
    count:   counts[k],
    variant: variantFor(k),
    dotOnPositive: k === "OVERDUE",
  }));

  const hasActiveFilters = tab !== "ALL" || !!search.trim();

  return (
    <div className="space-y-5">
      {/* ── Filters (client-side, instant) ─────────────────────── */}
      <FilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); setPageIndex(0); },
          placeholder: tSearch("placeholder"),
        }}
        quickFilters={quickFilters}
        activeQuickFilter={tab}
        onQuickFilterChange={(s) => { setTab(s as StatusTab); setPageIndex(0); }}
        activeFiltersDisplay="hidden"
      />

      {/* ── Table ───────────────────────────────────────────────── */}
      <DataTable<InvoiceRow>
        data={filtered}
        columns={columns}
        mode="client"
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          onChange: ({ pageIndex: next }) => setPageIndex(next),
        }}
        rowActions={(r) => {
          const isDraft = r.status === "DRAFT";
          const isCancelled = r.status === "CANCELLED";
          const hasBalance = r.balanceDue > 0;
          return [
            {
              id: "issue",
              label: tRow("issue"),
              icon: <CheckCircleIcon className="h-4 w-4" />,
              visible: isDraft && canEditInvoice,
              onClick: () => router.push(`/dashboard/invoices/${r.id}`),
            },
            {
              id: "pay",
              label: tRow("pay"),
              icon: <CreditCardIcon className="h-4 w-4" />,
              visible: !isDraft && !isCancelled && hasBalance && canRecordPayment,
              onClick: () =>
                router.push(`/dashboard/invoices/${r.id}?action=payment`),
            },
            {
              id: "print",
              label: tRow("print"),
              icon: <PrinterIcon className="h-4 w-4" />,
              visible: !isDraft && !isCancelled,
              onClick: () => window.open(`/api/invoices/${r.id}/pdf`, "_blank"),
            },
            {
              id: "view",
              label: tRow("view"),
              icon: <EyeIcon className="h-4 w-4" />,
              visible: isCancelled,
              onClick: () => router.push(`/dashboard/invoices/${r.id}`),
            },
          ];
        }}
        rowVariant={invoiceRowVariant}
        hasActiveFilters={hasActiveFilters}
        emptyState={
          <NoInvoicesFirstTime
            onCreate={() => router.push("/dashboard/reservations")}
          />
        }
        noResultsState={
          <NoInvoicesForFilters
            onClearFilters={() => { setTab("ALL"); setSearch(""); setPageIndex(0); }}
          />
        }
        aria-label={tTbl("invoiceNumber")}
      />

      {/* ── Footer totals (sum over filtered rows) ──────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-fg-tertiary">
          <span>
            {tFooter("total")}:{" "}
            <strong className="text-fg ltr-numbers">
              {formatCurrency(sums.total, currency)}
            </strong>
          </span>
          <span>
            {tFooter("paid")}:{" "}
            <strong className="text-success-700 ltr-numbers">
              {formatCurrency(sums.paid, currency)}
            </strong>
          </span>
          <span>
            {tFooter("balance")}:{" "}
            <strong className={`ltr-numbers ${sums.balance > 0 ? "text-error-600" : "text-fg"}`}>
              {formatCurrency(sums.balance, currency)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
