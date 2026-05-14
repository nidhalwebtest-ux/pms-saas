"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { useLocale } from "next-intl";

export interface DataTablePaginationProps {
  pageIndex: number;
  pageSize: number;
  /** Total row count (server / client mode). Pager hides when unknown + only 1 page. */
  totalCount: number;
  /** Selectable page sizes. Default `[10, 25, 50, 100]`. */
  pageSizes?: number[];
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  /** Hide the page-size selector — for fixed-page tables. */
  hidePageSize?: boolean;
}

/**
 * Compact page list with ellipses. Always includes first + last; the active
 * page sits centered with one neighbor on each side once we exceed 7 pages.
 */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "…")[] = [1];
  if (current > 4) pages.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 3) pages.push("…");
  pages.push(total);
  return pages;
}

export function DataTablePagination({
  pageIndex,
  pageSize,
  totalCount,
  pageSizes = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  hidePageSize,
}: DataTablePaginationProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const currentPage = pageIndex + 1; // 1-based for display
  const firstRow = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(totalCount, (pageIndex + 1) * pageSize);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  // For RTL we visually flip the pager controls so first/prev/next/last read in
  // reading order, while keeping numerals LTR.
  const directionClass = isRTL ? "flex-row-reverse" : "";

  const pageList = buildPageList(currentPage, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 h-13 bg-subtle/50 border-t border-border-subtle">
      {/* Range + page-size */}
      <div className="flex items-center gap-4 text-xs text-fg-tertiary">
        <span dir="ltr" className="tabular-nums">
          {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {totalCount.toLocaleString()}
        </span>
        {!hidePageSize && (
          <label className="inline-flex items-center gap-2">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-border-default bg-surface px-2 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              aria-label="Rows per page"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Pager */}
      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className={`flex items-center gap-1 ${directionClass}`}
        >
          <PagerButton
            icon={<ChevronDoubleLeftIcon className="h-4 w-4" />}
            label="First page"
            disabled={!canPrev}
            onClick={() => onPageChange(0)}
          />
          <PagerButton
            icon={<ChevronLeftIcon className="h-4 w-4" />}
            label="Previous page"
            disabled={!canPrev}
            onClick={() => onPageChange(pageIndex - 1)}
          />
          <div className="flex items-center gap-1 tabular-nums" dir="ltr">
            {pageList.map((p, i) =>
              p === "…" ? (
                <span
                  key={`gap-${i}`}
                  aria-hidden="true"
                  className="px-1 text-xs text-fg-tertiary"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p - 1)}
                  aria-current={p === currentPage ? "page" : undefined}
                  aria-label={`Page ${p}`}
                  className={
                    p === currentPage
                      ? "h-7 min-w-7 px-2 rounded-md bg-brand-500 text-white text-xs font-semibold"
                      : "h-7 min-w-7 px-2 rounded-md text-xs font-medium text-fg hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  }
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <PagerButton
            icon={<ChevronRightIcon className="h-4 w-4" />}
            label="Next page"
            disabled={!canNext}
            onClick={() => onPageChange(pageIndex + 1)}
          />
          <PagerButton
            icon={<ChevronDoubleRightIcon className="h-4 w-4" />}
            label="Last page"
            disabled={!canNext}
            onClick={() => onPageChange(totalPages - 1)}
          />
        </nav>
      )}
    </div>
  );
}

function PagerButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-40 disabled:pointer-events-none"
    >
      {icon}
    </button>
  );
}
