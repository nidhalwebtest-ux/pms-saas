"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const PERIOD_TABS = ["all", "today", "week", "month"] as const;
const METHODS = ["", "CASH", "CARD", "BANK_TRANSFER", "CHEQUE"] as const;

interface Props {
  currentPeriod: string;
  currentQ:      string;
  currentMethod: string;
  counts: { all: number; today: number; week: number; month: number };
}

export default function PaymentsFilters({
  currentPeriod,
  currentQ,
  currentMethod,
  counts,
}: Props) {
  const tRoot   = useTranslations("payments");
  const tTabs   = useTranslations("payments.tabs");
  const tList   = useTranslations("payments.list");
  const tMethod = useTranslations("payments.methods");

  const [, setFilters] = useFilterParams({
    period: { default: "all", serialize: "raw" },
    q:      { default: "",    serialize: "raw" },
    method: { default: "",    serialize: "raw" },
  });

  const quickFilters: QuickFilter[] = PERIOD_TABS.map((key) => ({
    id:    key,
    label: tTabs(key),
    count: counts[key],
  }));

  return (
    <FilterBar
      search={{
        value: currentQ,
        onChange: (q) => setFilters({ q }),
        placeholder: tList("searchPlaceholder"),
      }}
      quickFilters={quickFilters}
      activeQuickFilter={currentPeriod}
      onQuickFilterChange={(period) => setFilters({ period })}
      filters={[
        {
          id:       "method",
          type:     "select",
          label:    tRoot("paymentMethod"),
          value:    currentMethod || "",
          allValue: "",
          onChange: (method) => setFilters({ method }),
          options:  METHODS.map((m) => ({
            value: m,
            label: m === "" ? tList("allMethods") : tMethod(m as Exclude<typeof METHODS[number], "">),
          })),
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ method: "" })}
    />
  );
}
