"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { DataTable, FilterBar, type QuickFilter } from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";
import { deleteCashDeposit } from "../cashier/actions";
import { buildDepositColumns, type DepositRow } from "./columns";

const PAGE_SIZE = 50;
const PERIOD_TABS = ["all", "today", "week", "month"] as const;
type Period = (typeof PERIOD_TABS)[number];

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }

/** Inclusive lower bound for a period tab (no upper bound — everything up to now). */
function periodStart(p: Period): number | null {
  const today = startOfDay(new Date());
  if (p === "today") return today.getTime();
  if (p === "week") { const w = new Date(today); w.setDate(today.getDate() - today.getDay()); return w.getTime(); }
  if (p === "month") return new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  return null;
}

export default function DepositsView({
  deposits,
  currency,
  buildings,
  canManage,
}: {
  deposits: DepositRow[];
  currency: string;
  buildings: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("deposits.filters");
  const tTabs = useTranslations("deposits.tabs");
  const tTbl = useTranslations("deposits.table");
  const tList = useTranslations("deposits.list");

  // ── Filter state (all client-side, instant) ──────────────────────────────
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [building, setBuilding] = useState("");

  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);

  // Tab counts honor the active building filter (matches the prior server
  // behavior where building scope applied before the period counts).
  const buildingScoped = useMemo(
    () => (building ? deposits.filter((d) => d.buildingId === building) : deposits),
    [deposits, building],
  );

  const counts = useMemo(() => {
    const c: Record<Period, number> = { all: 0, today: 0, week: 0, month: 0 };
    for (const d of buildingScoped) {
      const ts = new Date(d.date).getTime();
      c.all++;
      if (ts >= periodStart("today")!) c.today++;
      if (ts >= periodStart("week")!) c.week++;
      if (ts >= periodStart("month")!) c.month++;
    }
    return c;
  }, [buildingScoped]);

  const filtered = useMemo(() => {
    let rows = buildingScoped;
    const start = periodStart(period);
    if (start != null) rows = rows.filter((d) => new Date(d.date).getTime() >= start);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) =>
          (d.reference?.toLowerCase().includes(q) ?? false) ||
          d.building.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [buildingScoped, period, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  const columns = useMemo(() => buildDepositColumns({ tTbl, currency }), [tTbl, currency]);

  const hasActiveFilters = !!search || !!building || period !== "all";

  const rowActions = canManage
    ? (r: DepositRow) => [
        {
          id: "delete",
          label: tList("delete"),
          icon: <TrashIcon className="h-4 w-4" />,
          onClick: async () => {
            if (!confirm(tList("deleteConfirm"))) return;
            const res = await deleteCashDeposit(r.groupId);
            if (res.error) { toast.error(res.error); return; }
            toast.success(tList("deleted"));
            router.refresh();
          },
        },
      ]
    : undefined;

  const quickFilters: QuickFilter[] = PERIOD_TABS.map((key) => ({
    id: key, label: tTabs(key), count: counts[key],
  }));

  return (
    <div className="space-y-4">
      <FilterBar
        search={{
          value: search,
          onChange: (q) => { setSearch(q); setPageIndex(0); },
          placeholder: t("searchPlaceholder"),
        }}
        quickFilters={quickFilters}
        activeQuickFilter={period}
        onQuickFilterChange={(p) => { setPeriod(p as Period); setPageIndex(0); }}
        filters={buildings.length > 1 ? [
          {
            id: "building",
            type: "select",
            label: t("building"),
            value: building || "",
            allValue: "",
            onChange: (b) => { setBuilding(b); setPageIndex(0); },
            options: [
              { value: "", label: t("allBuildings") },
              ...buildings.map((b) => ({ value: b.id, label: b.name })),
            ],
          },
        ] : []}
        activeFiltersDisplay="chips"
        onClearAll={() => { setBuilding(""); setPageIndex(0); }}
      />

      <DataTable<DepositRow>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        pagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          onChange: ({ pageIndex: next }) => setPageIndex(next),
        }}
        rowActions={rowActions}
        hasActiveFilters={hasActiveFilters}
        aria-label={tList("title")}
      />

      {filtered.length > 0 && (
        <div className="px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("totalsLabel", { count: filtered.length })}{" "}
            <strong className="text-fg tabular-nums ltr-numbers ms-2">{formatAmount(total, currency)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
