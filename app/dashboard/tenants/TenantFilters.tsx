"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

const STATUS_TABS = ["all", "active", "inactive"] as const;
type StatusKey = typeof STATUS_TABS[number];

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
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const t      = useTranslations("tenants.filters");
  const tTypes = useTranslations("tenants.types");
  const tSrc   = useTranslations("tenants.sources");

  const [searchTerm, setSearchTerm]     = useState(currentSearch);
  const [showAdvanced, setShowAdvanced] = useState(!!currentTenantType || !!currentSource);

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

  const hasAdvFilters = !!currentTenantType || !!currentSource;

  const statusLabel = (k: StatusKey) =>
    k === "all" ? t("statusAll") : k === "active" ? t("statusActive") : t("statusInactive");

  const activeStatus: StatusKey =
    (currentStatus as StatusKey) && STATUS_TABS.includes(currentStatus as StatusKey)
      ? (currentStatus as StatusKey)
      : "all";

  const sourceLabel = (v: string) => {
    if (!v) return t("allSources");
    try { return tSrc(v as never); } catch { return v; }
  };
  const typeLabel = (v: string) => {
    if (!v) return t("allTypes");
    try { return tTypes(v as never); } catch { return v; }
  };

  return (
    <>
      {/* ── Status tabs (mirror buildings + units) ───────────────────────── */}
      <div className="flex flex-wrap gap-1 mb-1">
        {STATUS_TABS.map((key) => {
          const active = activeStatus === key;
          const count  = counts[key] ?? 0;
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

        {showAdvanced && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {t("typeLabel")}
                </label>
                <select
                  value={currentTenantType}
                  onChange={(e) => push({ tenantType: e.target.value })}
                  className="block w-full rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  {TENANT_TYPES.map((v) => (
                    <option key={v || "ALL"} value={v}>{typeLabel(v)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {t("sourceLabel")}
                </label>
                <select
                  value={currentSource}
                  onChange={(e) => push({ source: e.target.value })}
                  className="block w-full rounded-lg border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  {SOURCE_VALUES.map((v) => (
                    <option key={v || "ALL"} value={v}>{sourceLabel(v)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
