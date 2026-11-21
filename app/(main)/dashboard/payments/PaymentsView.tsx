"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EyeIcon, PrinterIcon } from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import {
  DataTable,
  FilterBar,
  NoPaymentsFirstTime,
  type QuickFilter,
} from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";
import { buildPaymentColumns, type PaymentRow } from "./columns";

// ── Constants ──────────────────────────────────────────────────────────────────

const PERIOD_TABS = ["all", "today", "week", "month"] as const;
type PeriodTab = (typeof PERIOD_TABS)[number];
const METHODS = ["", "CASH", "CARD", "BANK_TRANSFER", "CHEQUE"] as const;

// ── Date-range helpers (client-side period filter) ─────────────────────────────

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Inclusive lower-bound timestamp for a period tab; null = no lower bound. */
function periodFloor(p: PeriodTab): number | null {
  const now = new Date();
  const today = startOfDay(now);
  if (p === "today") return today.getTime();
  if (p === "week") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday
    return weekStart.getTime();
  }
  if (p === "month") return new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface PaymentsViewProps {
  payments: PaymentRow[];
  currency: string;
}

/**
 * Client view for the payments list. Loads ALL org/building-scoped payments
 * once; tabs, search and the method dropdown all filter instantly client-side
 * (no DB refetch). Footer totals are computed over the filtered rows.
 */
export default function PaymentsView({ payments, currency }: PaymentsViewProps) {
  const router = useRouter();
  const tRoot = useTranslations("payments");
  const tTabs = useTranslations("payments.tabs");
  const tList = useTranslations("payments.list");
  const tTbl = useTranslations("payments.table");
  const tMethod = useTranslations("payments.methods");

  // ── Filter state (all client-side) ────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodTab>("all");
  const [method, setMethod] = useState("");

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  // ── Tab counts (period-only, client-side) ─────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<PeriodTab, number> = { all: 0, today: 0, week: 0, month: 0 };
    const todayFloor = periodFloor("today")!;
    const weekFloor = periodFloor("week")!;
    const monthFloor = periodFloor("month")!;
    for (const p of payments) {
      const t = new Date(p.date).getTime();
      c.all += 1;
      if (t >= todayFloor) c.today += 1;
      if (t >= weekFloor) c.week += 1;
      if (t >= monthFloor) c.month += 1;
    }
    return c;
  }, [payments]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = payments;
    const floor = periodFloor(period);
    if (floor != null) rows = rows.filter((p) => new Date(p.date).getTime() >= floor);
    if (method) rows = rows.filter((p) => p.method === method);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        `${p.tenant.firstName ?? ""} ${p.tenant.lastName ?? ""}`.toLowerCase().includes(q) ||
        (p.paymentNumber?.toLowerCase().includes(q) ?? false) ||
        (p.reference?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [payments, period, method, search]);

  // ── Footer totals (over filtered rows) ────────────────────────────────────
  const totals = useMemo(() => {
    const t = { all: 0, CASH: 0, CARD: 0, BANK_TRANSFER: 0, CHEQUE: 0 };
    for (const p of filtered) {
      t.all += p.amount;
      if (p.method === "CASH") t.CASH += p.amount;
      if (p.method === "CARD") t.CARD += p.amount;
      if (p.method === "BANK_TRANSFER") t.BANK_TRANSFER += p.amount;
      if (p.method === "CHEQUE") t.CHEQUE += p.amount;
    }
    return t;
  }, [filtered]);

  const columns = useMemo(
    () => buildPaymentColumns({ tList, tTbl, tMethod, currency }),
    [tList, tTbl, tMethod, currency],
  );

  const rowActions = (r: PaymentRow) => [
    {
      id: "print",
      label: tList("print"),
      icon: <PrinterIcon className="h-4 w-4" />,
      onClick: () => {
        window.open(`/api/payments/${r.id}/receipt-pdf`, "_blank", "noopener,noreferrer");
      },
    },
    {
      id: "view",
      label: tList("view"),
      icon: <EyeIcon className="h-4 w-4" />,
      onClick: () => router.push(`/dashboard/payments/${r.id}`),
    },
  ];

  const quickFilters: QuickFilter[] = PERIOD_TABS.map((key) => ({
    id: key,
    label: tTabs(key),
    count: counts[key],
  }));

  const hasActiveFilters = !!search || !!method || period !== "all";

  return (
    <div className="space-y-4">
      {/* ── Filters (client-side, instant) ── */}
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: tList("searchPlaceholder"),
        }}
        quickFilters={quickFilters}
        activeQuickFilter={period}
        onQuickFilterChange={(p) => setPeriod(p as PeriodTab)}
        filters={[
          {
            id: "method",
            type: "select",
            label: tRoot("paymentMethod"),
            value: method,
            allValue: "",
            onChange: setMethod,
            options: METHODS.map((m) => ({
              value: m,
              label:
                m === ""
                  ? tList("allMethods")
                  : tMethod(m as Exclude<(typeof METHODS)[number], "">),
            })),
          },
        ]}
        activeFiltersDisplay="chips"
        onClearAll={() => setMethod("")}
      />

      {/* ── Table ── */}
      <DataTable<PaymentRow>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        rowActions={rowActions}
        hasActiveFilters={hasActiveFilters}
        emptyState={
          <NoPaymentsFirstTime
            onRecord={() => router.push("/dashboard/payments/new")}
          />
        }
        aria-label={tTbl("receiptNumber")}
      />

      {/* ── Footer totals (by method) ── */}
      {filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("totalsLabel", { count: filtered.length })}{" "}
            <strong className="text-success-700 tabular-nums ltr-numbers ms-2">
              {formatAmount(totals.all, currency)}
            </strong>
          </span>
          <div className="flex flex-wrap gap-3">
            <span className="text-success-700 ltr-numbers">
              {tList("cashTotal", { total: formatAmount(totals.CASH, currency) })}
            </span>
            <span className="text-brand-700 ltr-numbers">
              {tList("cardTotal", { total: formatAmount(totals.CARD, currency) })}
            </span>
            <span className="text-fg-secondary ltr-numbers">
              {tList("bankTotal", { total: formatAmount(totals.BANK_TRANSFER, currency) })}
            </span>
            <span className="text-warning-700 ltr-numbers">
              {tList("chequeTotal", { total: formatAmount(totals.CHEQUE, currency) })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
