"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const STATUS_TABS = ["all", "active", "inactive"] as const;
const TENANT_TYPES = ["", "individual", "family", "corporate", "government"] as const;
const SOURCE_VALUES = [
  "", "walk_in", "referral", "online", "agent", "returning", "returning_guest", "corporate_contract",
] as const;

interface Props {
  currentSearch:     string;
  currentStatus:     string;
  currentTenantType: string;
  currentSource:     string;
  counts: { all: number; active: number; inactive: number };
}

export default function TenantFilters({
  currentSearch,
  currentStatus,
  currentTenantType,
  currentSource,
  counts,
}: Props) {
  const t      = useTranslations("tenants.filters");
  const tTypes = useTranslations("tenants.types");
  const tSrc   = useTranslations("tenants.sources");

  const [, setFilters] = useFilterParams({
    q:          { default: "",      serialize: "raw" },
    status:     { default: "all",   serialize: "raw" },
    tenantType: { default: "",      serialize: "raw" },
    source:     { default: "",      serialize: "raw" },
  });

  const statusLabel = (k: typeof STATUS_TABS[number]) =>
    k === "all" ? t("statusAll") : k === "active" ? t("statusActive") : t("statusInactive");

  const activeStatus =
    (STATUS_TABS as readonly string[]).includes(currentStatus) ? currentStatus : "all";

  const typeLabel = (v: string) => {
    if (!v) return t("allTypes");
    try { return tTypes(v as never); } catch { return v; }
  };
  const sourceLabel = (v: string) => {
    if (!v) return t("allSources");
    try { return tSrc(v as never); } catch { return v; }
  };

  const quickFilters: QuickFilter[] = STATUS_TABS.map((key) => ({
    id:    key,
    label: statusLabel(key),
    count: counts[key] ?? 0,
  }));

  return (
    <FilterBar
      search={{
        value: currentSearch,
        onChange: (q) => setFilters({ q }),
        placeholder: t("searchPlaceholder"),
      }}
      quickFilters={quickFilters}
      activeQuickFilter={activeStatus}
      onQuickFilterChange={(s) => setFilters({ status: s === "all" ? "" : s })}
      filters={[
        {
          id:       "tenantType",
          type:     "select",
          label:    t("typeLabel"),
          value:    currentTenantType || "",
          allValue: "",
          onChange: (tenantType) => setFilters({ tenantType }),
          options:  TENANT_TYPES.map((v) => ({ value: v, label: typeLabel(v) })),
        },
        {
          id:       "source",
          type:     "select",
          label:    t("sourceLabel"),
          value:    currentSource || "",
          allValue: "",
          onChange: (source) => setFilters({ source }),
          options:  SOURCE_VALUES.map((v) => ({ value: v, label: sourceLabel(v) })),
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ tenantType: "", source: "" })}
    />
  );
}
