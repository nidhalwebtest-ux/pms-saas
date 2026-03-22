"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [isExpanded, setIsExpanded] = useState(true);

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== currentSearch) {
        router.push(pathname + "?" + createQueryString({ q: searchTerm }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, currentSearch, pathname, createQueryString, router]);

  const hasActiveFilters = currentSearch || currentClassification || currentTenantType || currentSource;

  function clearAll() {
    setSearchTerm("");
    router.push(pathname);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
          {!isExpanded && hasActiveFilters && (
            <span className="ml-2 flex h-2 w-2 rounded-full bg-blue-600" />
          )}
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="sm:col-span-2 relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                placeholder="Search name, phone, email, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Classification */}
            <select
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
              value={currentClassification}
              onChange={(e) =>
                router.push(pathname + "?" + createQueryString({ classification: e.target.value }))
              }
            >
              <option value="">All Classifications</option>
              <option value="regular">Regular</option>
              <option value="vip">VIP</option>
              <option value="blacklisted">Blacklisted</option>
            </select>

            {/* Tenant Type */}
            <select
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
              value={currentTenantType}
              onChange={(e) =>
                router.push(pathname + "?" + createQueryString({ tenantType: e.target.value }))
              }
            >
              <option value="">All Types</option>
              <option value="individual">Individual</option>
              <option value="family">Family</option>
              <option value="corporate">Corporate</option>
              <option value="government">Government</option>
            </select>
          </div>

          {/* Source row + clear */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <select
              className="rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm text-xs"
              value={currentSource}
              onChange={(e) =>
                router.push(pathname + "?" + createQueryString({ source: e.target.value }))
              }
            >
              <option value="">All Sources</option>
              <option value="walk_in">Walk-In</option>
              <option value="referral">Referral</option>
              <option value="online">Online</option>
              <option value="agent">Agent</option>
              <option value="returning">Returning</option>
              <option value="corporate_contract">Corporate Contract</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
