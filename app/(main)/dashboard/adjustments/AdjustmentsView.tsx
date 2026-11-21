"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SortingState } from "@tanstack/react-table";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { DataTable, FilterBar, type QuickFilter } from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";
import { buildAdjustmentColumns, type AdjustmentRow } from "./columns";

const PERIOD_TABS = ["all", "today", "week", "month"] as const;
type PeriodTab = (typeof PERIOD_TABS)[number];

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }

export default function AdjustmentsView({
  adjustments,
  currency,
  buildings,
}: {
  adjustments: AdjustmentRow[];
  currency: string;
  buildings: { id: string; name: string }[];
}) {
  const t = useTranslations("adjustments");
  const tList = useTranslations("adjustments.list");
  const tTbl = useTranslations("adjustments.table");
  const tFilters = useTranslations("adjustments.filters");
  const tTabs = useTranslations("adjustments.tabs");

  const [period, setPeriod] = useState<PeriodTab>("all");
  const [building, setBuilding] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);

  // ── Period predicate (client-side) ──────────────────────────────────────
  const periodMatch = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return (p: PeriodTab, iso: string): boolean => {
      if (p === "all") return true;
      const d = new Date(iso);
      if (p === "today") return d >= today;
      if (p === "week") return d >= weekStart;
      if (p === "month") return d >= monthStart;
      return true;
    };
  }, []);

  // ── Tab counts (period only; ignores building dropdown, like before) ─────
  const counts = useMemo(() => ({
    all:   adjustments.filter((a) => periodMatch("all", a.date)).length,
    today: adjustments.filter((a) => periodMatch("today", a.date)).length,
    week:  adjustments.filter((a) => periodMatch("week", a.date)).length,
    month: adjustments.filter((a) => periodMatch("month", a.date)).length,
  }), [adjustments, periodMatch]);

  const filtered = useMemo(() => {
    let rows = adjustments;
    if (building) rows = rows.filter((a) => a.propertyId === building);
    rows = rows.filter((a) => periodMatch(period, a.date));
    return rows;
  }, [adjustments, building, period, periodMatch]);

  const net = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  const columns = useMemo(() => buildAdjustmentColumns({ tTbl, currency }), [tTbl, currency]);

  const quickFilters: QuickFilter[] = PERIOD_TABS.map((key) => ({
    id: key, label: tTabs(key), count: counts[key],
  }));

  const hasActiveFilters = !!building || period !== "all";

  return (
    <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-md">
          <ScaleIcon className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tList("summary", { count: filtered.length, net: formatAmount(net, currency) })}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <FilterBar
          quickFilters={quickFilters}
          activeQuickFilter={period}
          onQuickFilterChange={(p) => setPeriod(p as PeriodTab)}
          filters={buildings.length > 1 ? [
            {
              id: "building",
              type: "select",
              label: tFilters("building"),
              value: building,
              allValue: "",
              onChange: setBuilding,
              options: [
                { value: "", label: tFilters("allBuildings") },
                ...buildings.map((b) => ({ value: b.id, label: b.name })),
              ],
            },
          ] : []}
          activeFiltersDisplay="chips"
          onClearAll={() => setBuilding("")}
        />
      </div>

      <DataTable<AdjustmentRow>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        hasActiveFilters={hasActiveFilters}
        aria-label={tList("title")}
      />

      {filtered.length > 0 && (
        <div className="mt-4 px-1 text-xs text-fg-tertiary">
          <span className="font-medium text-fg">
            {tList("netLabel", { count: filtered.length })}{" "}
            <strong className={`tabular-nums ltr-numbers ms-2 ${Math.abs(net) < 0.001 ? "text-fg" : net > 0 ? "text-success-700" : "text-danger-600"}`}>
              {net > 0 ? "+" : ""}{formatAmount(net, currency)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
