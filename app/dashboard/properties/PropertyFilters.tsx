"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

const TYPE_KEYS = ["", "RESIDENTIAL", "MIXED", "HOTEL", "COMMERCIAL"] as const;
const STATUS_TABS = ["all", "active", "inactive", "archived"] as const;

type StatusKey = typeof STATUS_TABS[number];
type StatusCounts = Record<StatusKey, number>;

interface Props {
  currentSearch: string;
  currentType:   string;
  currentStatus: string;
  totalResults:  number;
  statusCounts:  StatusCounts;
}

export default function PropertyFilters({
  currentSearch,
  currentType,
  currentStatus,
  totalResults,
  statusCounts,
}: Props) {
  void totalResults;
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const tF = useTranslations("buildings.filters");
  const tT = useTranslations("buildings.types");
  const tS = useTranslations("buildings.status");

  const [searchTerm, setSearchTerm]   = useState(currentSearch);
  const [showAdvanced, setShowAdvanced] = useState(!!currentType);

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
      params.delete("page"); // reset paging when filters change
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

  const hasAdvFilters = !!currentType;

  return (
    <>
      {/* ── Status tabs (mirror reservations primary tab row) ────────────── */}
      <div className="flex flex-wrap gap-1 mb-1">
        {STATUS_TABS.map((key) => {
          const active = currentStatus === key;
          const count  = statusCounts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => push({ status: key })}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tS(key)}
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

      {/* ── Search + filter bar (mirror reservations) ────────────────────── */}
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
              placeholder={tF("searchPlaceholder")}
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
                aria-label={tF("clearSearch")}
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
            {tF("filters")}
            {hasAdvFilters && <span className="h-2 w-2 rounded-full bg-blue-600" />}
          </button>
        </div>

        {/* Collapsible advanced filters: Type pills */}
        {showAdvanced && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pe-1">
                {tF("typeLabel")}
              </span>
              {TYPE_KEYS.map((value) => {
                const active = currentType === value;
                const label  = value === "" ? tT("all") : tT(value);
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
                    {label}
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
