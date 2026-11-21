"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { EyeIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { DataTable, EmptyState, FilterBar, type QuickFilter } from "@/components/ui";
import { formatCurrency } from "@/lib/format-currency";
import {
  buildReturnColumns,
  returnRowVariant,
  type ReturnRow,
} from "./columns";

const PAGE_SIZE = 20;

const STATUS_TABS = ["ALL", "ACTIVE", "REFUND_PENDING", "REFUNDED", "CANCELLED"] as const;
type StatusKey = typeof STATUS_TABS[number];

/** Client-side status predicate — mirrors the old server `statusWhere`. */
function matchesStatus(r: ReturnRow, status: StatusKey): boolean {
  switch (status) {
    case "ACTIVE":         return r.status === "active" && r.refundStatus === "NOT_REQUIRED";
    case "REFUND_PENDING": return r.status === "active" && r.refundStatus === "PENDING";
    case "REFUNDED":       return r.refundStatus === "COMPLETED";
    case "CANCELLED":      return r.status === "cancelled";
    default:               return true;
  }
}

export interface ReturnsViewProps {
  returns: ReturnRow[];
  currency: string;
}

export default function ReturnsView({ returns, currency }: ReturnsViewProps) {
  const router  = useRouter();
  const tTbl    = useTranslations("returns.table");
  const tStatus = useTranslations("returns.statuses");
  const tType   = useTranslations("returns.types");
  const tRow    = useTranslations("returns.rowActions");
  const tEmpty  = useTranslations("returns.empty");
  const tTabs   = useTranslations("returns.tabs");
  const tSearch = useTranslations("returns.search");
  const tFooter = useTranslations("returns.footer");
  const locale  = useLocale();

  // ── Filter state (all client-side, instant) ───────────────────────────────
  const [status, setStatus]   = useState<StatusKey>("ALL");
  const [search, setSearch]   = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => buildReturnColumns({ tTbl, tStatus, tType, currency, locale }),
    [tTbl, tStatus, tType, currency, locale],
  );

  // ── Tab counts (client-side) ───────────────────────────────────────────────
  const counts = useMemo(() => {
    const acc: Record<StatusKey, number> = {
      ALL: 0, ACTIVE: 0, REFUND_PENDING: 0, REFUNDED: 0, CANCELLED: 0,
    };
    for (const r of returns) {
      for (const k of STATUS_TABS) if (matchesStatus(r, k)) acc[k] += 1;
    }
    return acc;
  }, [returns]);

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (!matchesStatus(r, status)) return false;
      if (!q) return true;
      const name = `${r.tenant.firstName ?? ""} ${r.tenant.lastName ?? ""}`.toLowerCase();
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        name.includes(q) ||
        (r.reservation.reservationNumber?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [returns, status, search]);

  // ── Footer aggregates over filtered rows ───────────────────────────────────
  const { sumReturn, sumRefund } = useMemo(() => {
    let sumReturn = 0;
    let sumRefund = 0;
    for (const r of filtered) {
      sumReturn += r.returnAmount;
      sumRefund += r.refundAmount;
    }
    return { sumReturn, sumRefund };
  }, [filtered]);

  const hasActiveFilters = status !== "ALL" || !!search.trim();

  const labelFor = (k: StatusKey): string => {
    switch (k) {
      case "ALL":            return tTabs("all");
      case "ACTIVE":         return tTabs("active");
      case "REFUND_PENDING": return tTabs("refundPending");
      case "REFUNDED":       return tTabs("refunded");
      case "CANCELLED":      return tTabs("cancelled");
    }
  };

  const variantFor = (k: StatusKey): QuickFilter["variant"] => {
    if (k === "REFUND_PENDING") return "warning";
    if (k === "REFUNDED")       return "success";
    return undefined;
  };

  const quickFilters: QuickFilter[] = STATUS_TABS.map((k) => ({
    id:      k,
    label:   labelFor(k),
    count:   counts[k],
    variant: variantFor(k),
    dotOnPositive: k === "REFUND_PENDING",
  }));

  return (
    <div className="space-y-5">
      {/* Filters (client-side, instant) */}
      <FilterBar
        search={{
          value: search,
          onChange: (s) => { setSearch(s); setPageIndex(0); },
          placeholder: tSearch("placeholder"),
        }}
        quickFilters={quickFilters}
        activeQuickFilter={status}
        onQuickFilterChange={(s) => { setStatus(s as StatusKey); setPageIndex(0); }}
        activeFiltersDisplay="hidden"
      />

      {/* Table */}
      <DataTable<ReturnRow>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          onChange: ({ pageIndex: next }) => setPageIndex(next),
        }}
        rowActions={(r) => [
          {
            id: "view",
            label: tRow("view"),
            icon: <EyeIcon className="h-4 w-4" />,
            visible: true,
            onClick: () => router.push(`/dashboard/returns/${r.id}`),
          },
          {
            id: "refund",
            label: tRow("processRefund"),
            icon: <BanknotesIcon className="h-4 w-4" />,
            visible: r.status !== "cancelled" && r.refundRequired && r.refundStatus === "PENDING",
            onClick: () => router.push(`/dashboard/returns/${r.id}?action=refund`),
          },
        ]}
        rowVariant={returnRowVariant}
        hasActiveFilters={hasActiveFilters}
        emptyState={
          <EmptyState
            title={tEmpty("firstTitle")}
            description={tEmpty("firstDesc")}
            primaryAction={{
              label: tEmpty("goToReservations"),
              onClick: () => router.push("/dashboard/reservations"),
            }}
          />
        }
        noResultsState={
          <EmptyState
            variant="neutral"
            title={tEmpty("noResultsTitle")}
            description={tEmpty("noResultsDesc")}
            primaryAction={{
              label: tEmpty("clearFilters"),
              onClick: () => { setStatus("ALL"); setSearch(""); setPageIndex(0); },
            }}
          />
        }
        aria-label={tTbl("returnNumber")}
      />

      {/* Footer totals (over filtered rows) */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs text-fg-tertiary">
          <span>
            {tFooter("returned")}:{" "}
            <strong className="text-fg ltr-numbers">{formatCurrency(sumReturn, currency)}</strong>
          </span>
          <span>
            {tFooter("refunded")}:{" "}
            <strong className="text-success-700 ltr-numbers">{formatCurrency(sumRefund, currency)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
