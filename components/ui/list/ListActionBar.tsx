"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  DocumentArrowDownIcon,
  PrinterIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

interface Props {
  totalResults: number;
  currentSort: string;
}

export default function ListActionBar({ totalResults, currentSort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    router.push(pathname + "?" + params.toString());
  };

  return (
    <div className="bg-gray-100/50 px-4 py-2 rounded-t-lg border-x border-t border-gray-200 flex flex-wrap items-center justify-between text-sm">
      {/* Left: Tools */}
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Export CSV"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          <span className="hidden sm:inline">CSV</span>
        </button>
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Export PDF"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </button>
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Print List"
          onClick={() => window.print()}
        >
          <PrinterIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Print</span>
        </button>
        <div className="h-4 w-px bg-gray-300 mx-1"></div>
        <button
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Toggle Inline Editing"
        >
          <PencilSquareIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Inline Edit</span>
        </button>
      </div>

      {/* Right: Quick Sort & Totals */}
      <div className="flex items-center gap-4 mt-2 sm:mt-0">
        <div className="flex items-center gap-2 text-gray-600">
          <label htmlFor="quick-sort" className="hidden sm:block">
            Sort By:
          </label>
          <select
            id="quick-sort"
            className="block rounded-md border-0 py-1 pl-2 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-xs"
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="newest">Created (Newest)</option>
            <option value="oldest">Created (Oldest)</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
        </div>
        <div className="text-gray-500 font-medium">Total: {totalResults}</div>
      </div>
    </div>
  );
}
