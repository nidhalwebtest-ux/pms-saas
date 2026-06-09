"use client";

import { useTranslations } from "next-intl";
import { FilterBar, type QuickFilter } from "@/components/ui";
import { useFilterParams } from "@/hooks/useFilterParams";

const STATUS_TABS = ["all", "vacant", "occupied", "reserved", "maintenance"] as const;
const TYPE_OPTIONS = ["", "STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "SUITE"] as const;

interface Props {
  currentSearch:    string;
  currentProperty:  string;
  currentStatus:    string;
  currentType:      string;
  currentFloor:     string;
  properties:       { id: string; name: string }[];
  availableFloors:  number[];
  scopedToBuilding: boolean;
  counts: { all: number; vacant: number; occupied: number; reserved: number; maintenance: number };
  /** When false, the "Reserved" quick-filter tab is hidden (org setting). */
  showReserved?: boolean;
}

export default function UnitFilters({
  currentSearch,
  currentProperty,
  currentStatus,
  currentType,
  currentFloor,
  properties,
  availableFloors,
  scopedToBuilding,
  counts,
  showReserved = false,
}: Props) {
  const t      = useTranslations("units.filters");
  const tTypes = useTranslations("units.types");

  const [, setFilters] = useFilterParams({
    q:        { default: "",      serialize: "raw" },
    status:   { default: "all",   serialize: "raw" },
    property: { default: "",      serialize: "raw" },
    floor:    { default: "",      serialize: "raw" },
    type:     { default: "",      serialize: "raw" },
  });

  const statusLabel = (v: typeof STATUS_TABS[number]) => {
    switch (v) {
      case "all":         return t("statusAll");
      case "vacant":      return t("statusVacant");
      case "occupied":    return t("statusOccupied");
      case "reserved":    return t("statusReserved");
      case "maintenance": return t("statusMaintenance");
    }
  };

  const visibleTabs = showReserved
    ? STATUS_TABS
    : STATUS_TABS.filter((k) => k !== "reserved");
  const quickFilters: QuickFilter[] = visibleTabs.map((key) => ({
    id:    key,
    label: statusLabel(key),
    count: counts[key],
  }));

  // status param: "" or undefined ≡ "all"
  const activeStatus =
    (STATUS_TABS as readonly string[]).includes(currentStatus) ? currentStatus : "all";

  // Building options. When globally scoped, surface the locked building as the
  // only option so it shows in the trigger; otherwise prepend "All".
  const buildingOptions = scopedToBuilding
    ? properties.map((p) => ({ value: p.id, label: p.name }))
    : [
        { value: "", label: t("allProperties") },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ];

  const floorOptions = [
    { value: "", label: t("allFloors") },
    ...availableFloors.map((f) => ({
      value: String(f),
      label: f === 0 ? t("groundFloor") : t("floorN", { n: f }),
    })),
  ];

  const typeOptions = TYPE_OPTIONS.map((v) => ({
    value: v,
    label: v === "" ? t("allTypes") : (() => { try { return tTypes(v as never); } catch { return v; } })(),
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
          id:       "property",
          type:     "select",
          label:    t("buildingLabel"),
          value:    scopedToBuilding ? properties[0]?.id ?? "" : (currentProperty || ""),
          allValue: "",
          disabled: scopedToBuilding,
          helpText: scopedToBuilding ? t("scopedNote") : undefined,
          options:  buildingOptions,
          onChange: (property) => setFilters({ property }),
        },
        ...(availableFloors.length > 0 ? [{
          id:       "floor" as const,
          type:     "select" as const,
          label:    t("floorLabel"),
          value:    currentFloor || "",
          allValue: "",
          options:  floorOptions,
          onChange: (floor: string) => setFilters({ floor }),
        }] : []),
        {
          id:       "type",
          type:     "select",
          label:    t("typeLabel"),
          value:    currentType || "",
          allValue: "",
          options:  typeOptions,
          onChange: (type) => setFilters({ type }),
        },
      ]}
      activeFiltersDisplay="chips"
      onClearAll={() => setFilters({ property: "", floor: "", type: "" })}
    />
  );
}
