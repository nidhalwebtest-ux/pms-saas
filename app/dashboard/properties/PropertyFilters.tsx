"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

const TYPE_TABS = [
  { value: "",            label: "All Types" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "MIXED",       label: "Mixed Use" },
  { value: "HOTEL",       label: "Short-term" },
  { value: "COMMERCIAL",  label: "Commercial" },
];

const STATUS_TABS = [
  { value: "all",      label: "All" },
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface Props {
  currentSearch: string;
  currentType:   string;
  currentStatus: string;
  totalResults:  number;
}

export default function PropertyFilters({
  currentSearch,
  currentType,
  currentStatus,
  totalResults,
}: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const inputRef   = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Keep local search in sync if URL changes (e.g. browser back)
  useEffect(() => {
    setSearchTerm(currentSearch);
  }, [currentSearch]);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else   params.delete(k);
      }
      // Reset page when filters change
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
    currentType,
    currentStatus !== "active" ? currentStatus : "",
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearchTerm("");
    push({ q: "", type: "", status: "active" });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Top bar: search + meta ─────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {/* Icon */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <BuildingOfficeIcon className="h-4 w-4 text-blue-600" />
        </div>

        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, city, address…"
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(""); push({ q: "" }); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results count + clear */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:block text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{totalResults}</span>{" "}
            {totalResults === 1 ? "building" : "buildings"}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <FunnelIcon className="h-3 w-3" />
              Clear
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom bar: type pills + status pills ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/50">
        {/* Type pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pr-1">
            Type
          </span>
          {TYPE_TABS.map((tab) => {
            const active = currentType === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => push({ type: tab.value })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pr-1">
            Status
          </span>
          {STATUS_TABS.map((tab) => {
            const active = currentStatus === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => push({ status: tab.value })}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? tab.value === "active"
                      ? "bg-green-600 text-white shadow-sm"
                      : tab.value === "inactive"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-gray-700 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
