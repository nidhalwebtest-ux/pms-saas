"use client";

import { useLocale, useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";
import { STAGES, INTERESTS } from "../_lib/crm-options";
import { pickAreaLabel, type AreaOption } from "../_lib/area-label";

interface Props {
  currentSearch: string;
  currentTier: string; // all | 1 | 2 | 3
  currentStage: string;
  currentArea: string;
  currentInterest: string;
  counts: { all: number; t1: number; t2: number; t3: number };
  areas: AreaOption[];
}

export default function ProspectFilters({
  currentSearch,
  currentTier,
  currentStage,
  currentArea,
  currentInterest,
  counts,
  areas,
}: Props) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [, setFilters] = useFilterParams({
    q: { default: "", serialize: "raw" },
    tier: { default: "all", serialize: "raw" },
    stage: { default: "", serialize: "raw" },
    area: { default: "", serialize: "raw" },
    interest: { default: "", serialize: "raw" },
  });

  const tierTabs: QuickFilter[] = [
    { id: "all", label: t("prospects.filters.all"), count: counts.all },
    { id: "1", label: t("prospects.filters.tier1"), count: counts.t1 },
    { id: "2", label: t("prospects.filters.tier2"), count: counts.t2 },
    { id: "3", label: t("prospects.filters.tier3"), count: counts.t3 },
  ];

  const activeTier = ["all", "1", "2", "3"].includes(currentTier) ? currentTier : "all";

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (q) => setFilters({ q }),
        placeholder: t("prospects.filters.search"),
      }}
      quickFilters={tierTabs}
      activeQuickFilter={activeTier}
      onQuickFilterChange={(t) => setFilters({ tier: t === "all" ? "" : t })}
      filters={[
        {
          id: "stage",
          type: "select",
          label: t("prospects.filters.stage"),
          value: currentStage || "",
          allValue: "",
          onChange: (stage) => setFilters({ stage }),
          options: [
            { value: "", label: t("prospects.filters.allStages") },
            ...STAGES.map((v) => ({ value: v, label: t(`enums.stage.${v}`) })),
          ],
        },
        {
          id: "area",
          type: "select",
          label: t("prospects.filters.area"),
          value: currentArea || "",
          allValue: "",
          onChange: (area) => setFilters({ area }),
          options: [
            { value: "", label: t("prospects.filters.allAreas") },
            ...areas.map((a) => ({ value: a.id, label: pickAreaLabel(locale, a.name, a.nameAr) })),
          ],
        },
        {
          id: "interest",
          type: "select",
          label: t("prospects.filters.interest"),
          value: currentInterest || "",
          allValue: "",
          onChange: (interest) => setFilters({ interest }),
          options: [
            { value: "", label: t("prospects.filters.anyInterest") },
            ...INTERESTS.map((v) => ({ value: v, label: t(`enums.interest.${v}`) })),
          ],
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ stage: "", area: "", interest: "" })}
    />
  );
}
