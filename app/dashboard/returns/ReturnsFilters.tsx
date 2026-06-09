"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const STATUS_TABS = ["ALL", "ACTIVE", "REFUND_PENDING", "REFUNDED", "CANCELLED"] as const;
type StatusKey = typeof STATUS_TABS[number];

interface TabCount { key: StatusKey; count: number }

interface Props {
  currentStatus: string;
  currentSearch: string;
  counts: TabCount[];
}

export default function ReturnsFilters({ currentStatus, currentSearch, counts }: Props) {
  const tTabs   = useTranslations("returns.tabs");
  const tSearch = useTranslations("returns.search");

  const [, setFilters] = useFilterParams({
    status: { default: "ALL", serialize: "raw" },
    search: { default: "",    serialize: "raw" },
  });

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

  const countMap = new Map(counts.map((c) => [c.key, c.count]));

  const quickFilters: QuickFilter[] = STATUS_TABS.map((k) => ({
    id:      k,
    label:   labelFor(k),
    count:   countMap.get(k) ?? 0,
    variant: variantFor(k),
    dotOnPositive: k === "REFUND_PENDING",
  }));

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (search) => setFilters({ search }),
        placeholder: tSearch("placeholder"),
      }}
      quickFilters={quickFilters}
      activeQuickFilter={currentStatus}
      onQuickFilterChange={(status) => setFilters({ status })}
      activeFiltersDisplay="hidden"
    />
  );
}
