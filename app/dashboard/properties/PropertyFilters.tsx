"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const STATUS_TABS = ["all", "active", "inactive", "archived"] as const;
type StatusKey = typeof STATUS_TABS[number];
type StatusCounts = Record<StatusKey, number>;

const TYPE_OPTIONS = ["", "RESIDENTIAL", "MIXED", "HOTEL", "COMMERCIAL"] as const;

interface Props {
  currentSearch: string;
  currentType:   string;
  currentStatus: string;
  totalResults:  number;
  statusCounts:  StatusCounts;
}

export default function PropertyFilters({
  currentSearch,
  currentType,
  currentStatus,
  totalResults,
  statusCounts,
}: Props) {
  void totalResults;
  const tF = useTranslations("buildings.filters");
  const tT = useTranslations("buildings.types");
  const tS = useTranslations("buildings.status");

  const [, setFilters] = useFilterParams({
    q:      { default: "",       serialize: "raw" },
    type:   { default: "",       serialize: "raw" },
    status: { default: "active", serialize: "raw" },
  });

  const quickFilters: QuickFilter[] = STATUS_TABS.map((key) => ({
    id:    key,
    label: tS(key),
    count: statusCounts[key] ?? 0,
  }));

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (q) => setFilters({ q }),
        placeholder: tF("searchPlaceholder"),
      }}
      quickFilters={quickFilters}
      activeQuickFilter={currentStatus}
      onQuickFilterChange={(status) => setFilters({ status })}
      filters={[
        {
          id:       "type",
          type:     "select",
          label:    tF("typeLabel"),
          value:    currentType || "",
          allValue: "",
          onChange: (type) => setFilters({ type }),
          options:  TYPE_OPTIONS.map((v) => ({
            value: v,
            label: v === "" ? tT("all") : tT(v),
          })),
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ type: "" })}
    />
  );
}
