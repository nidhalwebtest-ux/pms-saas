"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

export default function TenantFilters({
  currentSearch,
  currentNationality,
}: {
  currentSearch: string;
  currentNationality: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [isExpanded, setIsExpanded] = useState(true);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(name, value);
      else params.delete(name);
      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm !== currentSearch) {
        router.push(pathname + "?" + createQueryString("q", searchTerm));
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentSearch, pathname, createQueryString, router]);

  const hasActiveFilters =
    currentSearch ||
    currentNationality ||
    searchParams.get("inactive") === "true";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 transition-all overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
          {!isExpanded && hasActiveFilters && (
            <span className="ml-2 flex h-2 w-2 rounded-full bg-blue-600"></span>
          )}
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Search name, phone, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <select
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                value={currentNationality}
                onChange={(e) =>
                  router.push(
                    pathname +
                      "?" +
                      createQueryString("nationality", e.target.value),
                  )
                }
              >
                <option value="">All Nationalities</option>
                <option value="Omani">Omani</option>
                <option value="Saudi">Saudi</option>
                <option value="Emirati">Emirati</option>
                <option value="Expat">Expat / Other</option>
              </select>
            </div>

            <div className="flex items-center pl-2">
              <input
                id="show-inactive"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                checked={searchParams.get("inactive") === "true"}
                onChange={(e) =>
                  router.push(
                    pathname +
                      "?" +
                      createQueryString(
                        "inactive",
                        e.target.checked ? "true" : "",
                      ),
                  )
                }
              />
              <label
                htmlFor="show-inactive"
                className="ml-2 text-sm text-gray-600 cursor-pointer"
              >
                Show Inactives
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
