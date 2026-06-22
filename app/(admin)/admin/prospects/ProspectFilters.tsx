"use client";

import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";
import {
  STAGES,
  AREAS,
  INTERESTS,
  STAGE_LABELS,
  AREA_LABELS,
  INTEREST_LABELS,
  toOptions,
} from "../_lib/crm-options";

interface Props {
  currentSearch: string;
  currentTier: string; // all | 1 | 2 | 3
  currentStage: string;
  currentArea: string;
  currentInterest: string;
  counts: { all: number; t1: number; t2: number; t3: number };
}

export default function ProspectFilters({
  currentSearch,
  currentTier,
  currentStage,
  currentArea,
  currentInterest,
  counts,
}: Props) {
  const [, setFilters] = useFilterParams({
    q: { default: "", serialize: "raw" },
    tier: { default: "all", serialize: "raw" },
    stage: { default: "", serialize: "raw" },
    area: { default: "", serialize: "raw" },
    interest: { default: "", serialize: "raw" },
  });

  const tierTabs: QuickFilter[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "1", label: "Tier 1", count: counts.t1 },
    { id: "2", label: "Tier 2", count: counts.t2 },
    { id: "3", label: "Tier 3", count: counts.t3 },
  ];

  const activeTier = ["all", "1", "2", "3"].includes(currentTier) ? currentTier : "all";

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (q) => setFilters({ q }),
        placeholder: "Search business or contact…",
      }}
      quickFilters={tierTabs}
      activeQuickFilter={activeTier}
      onQuickFilterChange={(t) => setFilters({ tier: t === "all" ? "" : t })}
      filters={[
        {
          id: "stage",
          type: "select",
          label: "Stage",
          value: currentStage || "",
          allValue: "",
          onChange: (stage) => setFilters({ stage }),
          options: toOptions(STAGES, STAGE_LABELS, "All stages"),
        },
        {
          id: "area",
          type: "select",
          label: "Area",
          value: currentArea || "",
          allValue: "",
          onChange: (area) => setFilters({ area }),
          options: toOptions(AREAS, AREA_LABELS, "All areas"),
        },
        {
          id: "interest",
          type: "select",
          label: "Interest",
          value: currentInterest || "",
          allValue: "",
          onChange: (interest) => setFilters({ interest }),
          options: toOptions(INTERESTS, INTEREST_LABELS, "Any interest"),
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ stage: "", area: "", interest: "" })}
    />
  );
}
