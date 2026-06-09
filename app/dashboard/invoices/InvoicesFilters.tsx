"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const STATUS_TABS = ["ALL", "DRAFT", "ISSUED", "OVERDUE", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
type StatusKey = typeof STATUS_TABS[number];

interface TabCount { key: StatusKey; count: number }

interface Props {
  currentStatus: string;
  currentSearch: string;
  counts: TabCount[];
}

export default function InvoicesFilters({ currentStatus, currentSearch, counts }: Props) {
  const tTabs   = useTranslations("invoices.tabs");
  const tSearch = useTranslations("invoices.search");

  const [, setFilters] = useFilterParams({
    status: { default: "ALL", serialize: "raw" },
    search: { default: "",    serialize: "raw" },
  });

  const labelFor = (k: StatusKey): string => {
    switch (k) {
      case "ALL":            return tTabs("all");
      case "DRAFT":          return tTabs("toBeIssued");
      case "ISSUED":         return tTabs("outstanding");
      case "OVERDUE":        return tTabs("overdue");
      case "PARTIALLY_PAID": return tTabs("partial");
      case "PAID":           return tTabs("paid");
      case "CANCELLED":      return tTabs("cancelled");
    }
  };

  const variantFor = (k: StatusKey): QuickFilter["variant"] => {
    if (k === "OVERDUE")  return "destructive";
    if (k === "DRAFT")    return "warning";
    if (k === "PAID")     return "success";
    return undefined;
  };

  const countMap = new Map(counts.map((c) => [c.key, c.count]));

  const quickFilters: QuickFilter[] = STATUS_TABS.map((k) => ({
    id:      k,
    label:   labelFor(k),
    count:   countMap.get(k) ?? 0,
    variant: variantFor(k),
    dotOnPositive: k === "OVERDUE",
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
