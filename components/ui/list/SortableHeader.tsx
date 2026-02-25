"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface Props {
  label: string;
  sortKey: string;
  className?: string; // To allow custom widths
}

export default function SortableHeader({
  label,
  sortKey,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "newest";

  // Check if this specific column is currently sorted
  const isAsc = currentSort === `${sortKey}_asc`;
  const isDesc = currentSort === `${sortKey}_desc`;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Toggle logic: Default to ASC, if ASC switch to DESC, if DESC switch to ASC
    if (isAsc) {
      params.set("sort", `${sortKey}_desc`);
    } else {
      params.set("sort", `${sortKey}_asc`);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <th
      scope="col"
      className={`px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-300 transition-colors group select-none ${className}`}
      onClick={handleClick}
      title={`Sort by ${label}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="flex flex-col">
          {isAsc ? (
            <ChevronUpIcon className="h-3 w-3 text-blue-600 stroke-[3]" />
          ) : isDesc ? (
            <ChevronDownIcon className="h-3 w-3 text-blue-600 stroke-[3]" />
          ) : (
            // Invisible placeholder to keep alignment, shows on hover
            <ChevronUpIcon className="h-3 w-3 opacity-0 group-hover:opacity-50 text-gray-500" />
          )}
        </span>
      </div>
    </th>
  );
}
