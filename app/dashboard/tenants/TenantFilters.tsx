"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function TenantFilters({
  currentSearch,
  currentClassification,
  currentTenantType,
  currentSource,
}: {
  currentSearch: string;
  currentClassification: string;
  currentTenantType: string;
  currentSource: string;
}) {
  const t       = useTranslations("tenants.filters");
  const tTypes  = useTranslations("tenants.types");
  const tSrc    = useTranslations("tenants.sources");
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch]       = useState(currentSearch);
  const [expanded, setExpanded]   = useState(true);

  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) p.set(k, v);
        else   p.delete(k);
      });
      return pathname + "?" + p.toString();
    },
    [searchParams, pathname],
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== currentSearch)
        router.push(buildUrl({ q: search }));
    }, 400);
    return () => clearTimeout(t);
  }, [search, currentSearch, buildUrl, router]);

  const hasFilters = currentSearch || currentClassification || currentTenantType || currentSource;

  function clearAll() {
    setSearch("");
    router.push(pathname);
  }

  function push(key: string, val: string) {
    router.push(buildUrl({ [key]: val }));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">{t("filtersBtn")}</span>
          {hasFilters && (
            <span className="inline-flex h-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
              {[currentSearch, currentClassification, currentTenantType, currentSource].filter(Boolean).length}
            </span>
          )}
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 space-y-3">
          {/* Row 1: search + classification + type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-lg border-0 py-2 ps-9 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Classification pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["", "regular", "vip", "blacklisted"] as const).map((val) => {
                const label =
                  val === ""            ? t("all")
                  : val === "regular"   ? t("regular")
                  : val === "vip"       ? t("vip")
                  :                       t("blacklisted");
                const active = currentClassification === val;
                return (
                  <button
                    key={val}
                    onClick={() => push("classification", val)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      active
                        ? val === "vip"         ? "bg-yellow-100 border-yellow-400 text-yellow-800"
                          : val === "blacklisted" ? "bg-red-100 border-red-400 text-red-700"
                          : "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Type select */}
            <select
              className="block w-full rounded-lg border-0 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
              value={currentTenantType}
              onChange={(e) => push("tenantType", e.target.value)}
            >
              <option value="">{t("allTypes")}</option>
              <option value="individual">{tTypes("individual")}</option>
              <option value="family">{tTypes("family")}</option>
              <option value="corporate">{tTypes("corporate")}</option>
              <option value="government">{tTypes("government")}</option>
            </select>
          </div>

          {/* Row 2: source + clear */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">{t("sourceLabel")}</span>
            {(["", "walk_in", "referral", "online", "agent", "returning", "returning_guest", "corporate_contract"] as const).map((val) => {
              const label = val === "" ? t("all") : (() => {
                try { return tSrc(val as never); } catch { return val; }
              })();
              const active = currentSource === val;
              return (
                <button
                  key={val}
                  onClick={() => push("source", val)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                    active
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}

            {hasFilters && (
              <button
                onClick={clearAll}
                className="ms-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                <XMarkIcon className="h-3.5 w-3.5" /> {t("clearAll")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
