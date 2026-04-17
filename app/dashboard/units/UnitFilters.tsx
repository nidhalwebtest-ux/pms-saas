"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  HomeModernIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

const STATUS_TAB_KEYS = ["all", "vacant", "occupied", "reserved", "maintenance"] as const;

const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  all:         "bg-gray-700 text-white shadow-sm",
  vacant:      "bg-emerald-600 text-white shadow-sm",
  occupied:    "bg-blue-600 text-white shadow-sm",
  reserved:    "bg-violet-600 text-white shadow-sm",
  maintenance: "bg-amber-500 text-white shadow-sm",
};

const TYPE_TAB_VALUES = ["", "STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "SUITE"] as const;

interface Props {
  currentSearch:   string;
  currentProperty: string;
  currentStatus:   string;
  currentType:     string;
  currentFloor:    string;
  properties:      { id: string; name: string }[];
  availableFloors: number[];
  counts:          { vacant: number; occupied: number; reserved: number; maintenance: number };
}

export default function UnitFilters({
  currentSearch,
  currentProperty,
  currentStatus,
  currentType,
  currentFloor,
  properties,
  availableFloors,
  counts,
}: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);
  const t            = useTranslations("units.filters");
  const tTypes       = useTranslations("units.types");

  const statusLabel = (v: string) => {
    if (v === "all")         return t("statusAll");
    if (v === "vacant")      return t("statusVacant");
    if (v === "occupied")    return t("statusOccupied");
    if (v === "reserved")    return t("statusReserved");
    if (v === "maintenance") return t("statusMaintenance");
    return v;
  };
  const typeLabel = (v: string) => {
    if (!v) return t("allTypes");
    try { return tTypes(v as never); } catch { return v; }
  };

  const [searchTerm, setSearchTerm] = useState(currentSearch);
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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== currentSearch) push({ q: searchTerm });
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilterCount = [
    currentSearch,
    currentProperty,
    currentStatus !== "all" ? currentStatus : "",
    currentType,
    currentFloor,
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearchTerm("");
    push({ q: "", property: "", status: "", type: "", floor: "" });
  };

  const countFor = (value: string): number | null => {
    if (value === "all")         return null;
    if (value === "vacant")      return counts.vacant;
    if (value === "occupied")    return counts.occupied;
    if (value === "reserved")    return counts.reserved;
    if (value === "maintenance") return counts.maintenance;
    return null;
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* ── Top bar: search + dropdowns ─────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <HomeModernIcon className="h-4 w-4 text-blue-600" />
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2 ps-9 pe-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(""); push({ q: "" }); inputRef.current?.focus(); }}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Property dropdown */}
        <select
          value={currentProperty}
          onChange={(e) => push({ property: e.target.value })}
          className="hidden sm:block rounded-lg border border-gray-200 bg-gray-50 py-2 ps-3 pe-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none transition"
        >
          <option value="">{t("allProperties")}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Floor dropdown */}
        {availableFloors.length > 0 && (
          <select
            value={currentFloor}
            onChange={(e) => push({ floor: e.target.value })}
            className="hidden md:block rounded-lg border border-gray-200 bg-gray-50 py-2 ps-3 pe-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none transition"
          >
            <option value="">{t("allFloors")}</option>
            {availableFloors.map((f) => (
              <option key={f} value={String(f)}>
                {f === 0 ? t("groundFloor") : t("floorN", { n: f })}
              </option>
            ))}
          </select>
        )}

        {/* Clear */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <FunnelIcon className="h-3 w-3" />
            {t("clear")}
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ltr-numbers">
              {activeFilterCount}
            </span>
          </button>
        )}
      </div>

      {/* ── Property (mobile) ───────────────────────────────────── */}
      <div className="sm:hidden border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
        <select
          value={currentProperty}
          onChange={(e) => push({ property: e.target.value })}
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 ps-3 pe-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">{t("allProperties")}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Type pills ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/30">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pe-1">
          {t("typeLabel")}
        </span>
        {TYPE_TAB_VALUES.map((value) => {
          const active = currentType === value || (value === "" && !currentType);
          return (
            <button
              key={value}
              onClick={() => push({ type: value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? "bg-blue-700 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {typeLabel(value)}
            </button>
          );
        })}

        {/* Floor pills (mobile) */}
        {availableFloors.length > 0 && (
          <>
            <span className="ms-3 text-[11px] font-medium text-gray-400 uppercase tracking-wide pe-1 md:hidden">
              {t("floorLabel")}
            </span>
            <select
              value={currentFloor}
              onChange={(e) => push({ floor: e.target.value })}
              className="md:hidden rounded-lg border border-gray-200 bg-white py-1 ps-2 pe-6 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">{t("allFloorsShort")}</option>
              {availableFloors.map((f) => (
                <option key={f} value={String(f)}>
                  {f === 0 ? t("groundShort") : t("floorShort", { n: f })}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* ── Status pills ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-gray-50/30">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pe-1">
          {t("statusLabel")}
        </span>
        {STATUS_TAB_KEYS.map((value) => {
          const active = currentStatus === value || (value === "all" && currentStatus === "all");
          const count  = countFor(value);
          return (
            <button
              key={value}
              onClick={() => push({ status: value === "all" ? "" : value })}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? STATUS_ACTIVE_CLASSES[value]
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {statusLabel(value)}
              {count !== null && count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ltr-numbers ${
                  active ? "bg-white/20" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
