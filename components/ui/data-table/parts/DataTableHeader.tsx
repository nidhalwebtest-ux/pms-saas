"use client";

import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { flexRender, type Table, type Header } from "@tanstack/react-table";
import type { TableDensity } from "../types";

export interface DataTableHeaderProps<T> {
  table: Table<T>;
  sticky?: boolean;
  density: TableDensity;
}

export function DataTableHeader<T>({
  table,
  sticky,
  density,
}: DataTableHeaderProps<T>) {
  const headerHeight = density === "compact" ? "h-10" : "h-12";

  return (
    <thead
      className={`bg-subtle border-b border-border-subtle ${
        sticky ? "sticky top-0 z-10" : ""
      }`}
    >
      {table.getHeaderGroups().map((group) => (
        <tr key={group.id}>
          {group.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              heightClass={headerHeight}
            />
          ))}
        </tr>
      ))}
    </thead>
  );
}

function HeaderCell<T>({
  header,
  heightClass,
}: {
  header: Header<T, unknown>;
  heightClass: string;
}) {
  if (header.isPlaceholder) {
    return <th className={`px-4 ${heightClass}`} />;
  }

  const meta = (header.column.columnDef.meta ?? {}) as {
    align?: "start" | "center" | "end";
    sticky?: "start" | "end";
  };
  const align =
    meta.align === "end"
      ? "text-end"
      : meta.align === "center"
      ? "text-center"
      : "text-start";

  const canSort = header.column.getCanSort();
  const sortDir = header.column.getIsSorted();
  const ariaSort =
    sortDir === "asc"
      ? "ascending"
      : sortDir === "desc"
      ? "descending"
      : canSort
      ? "none"
      : undefined;

  const widthStyle =
    header.column.columnDef.size !== undefined
      ? { width: header.column.columnDef.size }
      : undefined;

  const stickyClass =
    meta.sticky === "start"
      ? "sticky start-0 bg-subtle z-[1]"
      : meta.sticky === "end"
      ? "sticky end-0 bg-subtle z-[1]"
      : "";

  const baseClass = `px-4 ${heightClass} text-xs font-medium uppercase tracking-wider text-fg-tertiary ${align} select-none whitespace-nowrap ${stickyClass}`;

  if (!canSort) {
    return (
      <th scope="col" className={baseClass} style={widthStyle}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </th>
    );
  }

  return (
    <th scope="col" className={baseClass} style={widthStyle} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={header.column.getToggleSortingHandler()}
        className={`group inline-flex items-center gap-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded ${
          sortDir ? "text-fg" : ""
        }`}
      >
        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
        <SortIcon dir={sortDir} />
      </button>
    </th>
  );
}

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (dir === "asc") return <ChevronUpIcon className="h-3.5 w-3.5" />;
  if (dir === "desc") return <ChevronDownIcon className="h-3.5 w-3.5" />;
  return (
    <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
  );
}
