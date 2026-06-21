"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const PERIOD_TABS = ["all", "today", "week", "month"] as const;

export default function AdjustmentsFilters({
  currentPeriod,
  currentBuilding,
  counts,
  buildings,
}: {
  currentPeriod: string;
  currentBuilding: string;
  counts: { all: number; today: number; week: number; month: number };
  buildings: { id: string; name: string }[];
}) {
  const t = useTranslations("adjustments.filters");
  const tTabs = useTranslations("adjustments.tabs");

  const [, setFilters] = useFilterParams({
    period:   { default: "all", serialize: "raw" },
    building: { default: "",    serialize: "raw" },
  });

  const quickFilters: QuickFilter[] = PERIOD_TABS.map((key) => ({
    id: key, label: tTabs(key), count: counts[key],
  }));

  return (
    <FilterBar
      quickFilters={quickFilters}
      activeQuickFilter={currentPeriod}
      onQuickFilterChange={(period) => setFilters({ period })}
      filters={buildings.length > 1 ? [
        {
          id: "building",
          type: "select",
          label: t("building"),
          value: currentBuilding || "",
          allValue: "",
          onChange: (building) => setFilters({ building }),
          options: [
            { value: "", label: t("allBuildings") },
            ...buildings.map((b) => ({ value: b.id, label: b.name })),
          ],
        },
      ] : []}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ building: "" })}
    />
  );
}
