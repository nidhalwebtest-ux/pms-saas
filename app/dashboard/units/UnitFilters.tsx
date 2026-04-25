"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

const STATUS_TABS = ["all", "vacant", "occupied", "reserved", "maintenance"] as const;
type StatusKey = typeof STATUS_TABS[number];

const TYPE_TAB_VALUES = ["", "STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "SUITE"] as const;

interface Props {
  currentSearch:    string;
  currentProperty:  string;
  currentStatus:    string;
  currentType:      string;
  currentFloor:     string;
  properties:       { id: string; name: string }[];
  availableFloors:  number[];
  /** True when the global property selector has narrowed to one building. */
  scopedToBuilding: boolean;
  counts: { all: number; vacant: number; occupied: number; reserved: number; maintenance: number };
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
}: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);
  const t            = useTranslations("units.filters");
  const tTypes       = useTranslations("units.types");

  const [searchTerm, setSearchTerm]     = useState(currentSearch);
  const [showAdvanced, setShowAdvanced] = useState(
    !!currentProperty || !!currentType || !!currentFloor,
  );

  useEffect(() => { setSearchTerm(currentSearch); }, [currentSearch]);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else   params.delete(k);
      }
      params.delete("page");
      router.push(pathname + "?" + params.toString());
    },
    [searchParams, pathname, router],
  );

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== currentSearch) push({ q: searchTerm });
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAdvFilters = !!currentProperty || !!currentType || !!currentFloor;

  const statusLabel = (v: StatusKey) => {
    if (v === "all")         return t("statusAll");
    if (v === "vacant")      return t("statusVacant");
    if (v === "occupied")    return t("statusOccupied");
    if (v === "reserved")    return t("statusReserved");
    return t("statusMaintenance");
  };
  const typeLabel = (v: string) => {
    if (!v) return t("allTypes");
    try { return tTypes(v as never); } catch { return v; }
  };
  const countFor = (v: StatusKey) => counts[v];

  // status param: "" or undefined ≡ "all"
  const activeStatus: StatusKey =
    (currentStatus as StatusKey) && STATUS_TABS.includes(currentStatus as StatusKey)
      ? (currentStatus as StatusKey)
      : "all";

  return (
    <>
      {/* ── Status tabs (mirror buildings primary tab row) ───────────────── */}
      <div className="flex flex-wrap gap-1 mb-1">
        {STATUS_TABS.map((key) => {
          const active = activeStatus === key;
          const count  = countFor(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => push({ status: key === "all" ? "" : key })}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {statusLabel(key)}
              {count > 0 && (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ltr-numbers ${
                    active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + filter bar ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="block w-full rounded-lg border-0 py-2 ps-9 pe-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  push({ q: "" });
                  inputRef.current?.focus();
                }}
                className="absolute end-2 top-1/2 -translate-y-1/2"
                aria-label={t("clearSearch")}
              >
                <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Filters toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              showAdvanced || hasAdvFilters
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            {t("filters")}
            {hasAdvFilters && <span className="h-2 w-2 rounded-full bg-blue-600" />}
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {showAdvanced && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-3">
            {/* Building dropdown — locked to the global selection if scoped */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {t("buildingLabel")}
                </label>
                <select
                  value={scopedToBuilding ? properties[0]?.id ?? "" : currentProperty}
                  onChange={(e) => push({ property: e.target.value })}
                  disabled={scopedToBuilding}
                  className="block w-full rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {!scopedToBuilding && (
                    <option value="">{t("allProperties")}</option>
                  )}
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {scopedToBuilding && (
                  <p className="mt-1 text-[11px] text-gray-500">{t("scopedNote")}</p>
                )}
              </div>

              {/* Floor dropdown */}
              {availableFloors.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                    {t("floorLabel")}
                  </label>
                  <select
                    value={currentFloor}
                    onChange={(e) => push({ floor: e.target.value })}
                    className="block w-full rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t("allFloors")}</option>
                    {availableFloors.map((f) => (
                      <option key={f} value={String(f)}>
                        {f === 0 ? t("groundFloor") : t("floorN", { n: f })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Type pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pe-1">
                {t("typeLabel")}
              </span>
              {TYPE_TAB_VALUES.map((value) => {
                const active = currentType === value || (value === "" && !currentType);
                return (
                  <button
                    key={value || "ALL"}
                    type="button"
                    onClick={() => push({ type: value })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {typeLabel(value)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
