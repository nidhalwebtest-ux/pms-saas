"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EyeIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import type { VendorRow } from "./page";
import { DataTable, FilterBar, EmptyState, type QuickFilter } from "@/components/ui";
import { useCan } from "@/components/PermissionsProvider";
import { buildVendorColumns, vendorRowVariant } from "./columns";

type VendorTab = "all" | "active" | "inactive";

export default function VendorsView({
  vendors,
  categories,
}: {
  vendors: VendorRow[];
  categories: { id: string; name: string; nameAr: string | null }[];
}) {
  const tTable = useTranslations("vendors.list.table");
  const tFilters = useTranslations("vendors.filters");
  const tList = useTranslations("vendors.list");
  const router = useRouter();
  const canEdit = useCan("vendors", "EDIT");

  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<VendorTab>("active");
  const [category, setCategory] = useState("");

  const counts = useMemo(() => ({
    all: vendors.length,
    active: vendors.filter((v) => v.isActive).length,
    inactive: vendors.filter((v) => !v.isActive).length,
  }), [vendors]);

  const filtered = useMemo(() => {
    let rows = vendors;
    if (category) rows = rows.filter((v) => v.categoryId === category);
    switch (tab) {
      case "active": rows = rows.filter((v) => v.isActive); break;
      case "inactive": rows = rows.filter((v) => !v.isActive); break;
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((v) =>
        v.name.toLowerCase().includes(q) ||
        (v.nameAr?.toLowerCase().includes(q) ?? false) ||
        (v.phone?.toLowerCase().includes(q) ?? false) ||
        (v.email?.toLowerCase().includes(q) ?? false) ||
        (v.categoryName?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [vendors, category, tab, search]);

  const columns = useMemo(() => buildVendorColumns({ tTable }), [tTable]);

  const rowActions = useMemo(
    () => (r: VendorRow) => [
      {
        id: "view",
        label: tTable("view"),
        icon: <EyeIcon className="h-4 w-4" />,
        onClick: () => router.push(`/dashboard/vendors/${r.id}`),
      },
      {
        id: "edit",
        label: tTable("edit"),
        icon: <PencilSquareIcon className="h-4 w-4" />,
        visible: canEdit,
        onClick: () => router.push(`/dashboard/vendors/${r.id}/edit`),
      },
    ],
    [tTable, router, canEdit],
  );

  const tabLabel = (k: VendorTab) => {
    switch (k) {
      case "all": return tFilters("statusAll");
      case "active": return tFilters("statusActive");
      case "inactive": return tFilters("statusInactive");
    }
  };
  const TABS: VendorTab[] = ["all", "active", "inactive"];
  const quickFilters: QuickFilter[] = TABS.map((k) => ({ id: k, label: tabLabel(k)!, count: counts[k] }));

  return (
    <div className="space-y-3">
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: tFilters("searchPlaceholder") }}
        quickFilters={quickFilters}
        activeQuickFilter={tab}
        onQuickFilterChange={(s) => setTab(s as VendorTab)}
        filters={[
          {
            id: "category", type: "select", label: tFilters("categoryLabel"),
            value: category, allValue: "", onChange: setCategory,
            options: [
              { value: "", label: tFilters("allCategories") },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
        ]}
        activeFiltersDisplay="chips"
        onClearAll={() => setCategory("")}
      />

      <DataTable<VendorRow>
        data={filtered}
        columns={columns}
        mode="client"
        sorting={{ state: sorting, onChange: setSorting }}
        rowActions={rowActions}
        rowVariant={vendorRowVariant}
        hasActiveFilters={tab !== "active" || !!search || !!category}
        emptyState={
          <EmptyState
            title={tList("empty")}
            description={tList("emptyDescription")}
          />
        }
        aria-label={tTable("name")}
      />
      {filtered.length > 0 && (
        <p className="px-4 text-xs text-fg-tertiary">
          {tList("showing", { count: filtered.length })}
        </p>
      )}
    </div>
  );
}
