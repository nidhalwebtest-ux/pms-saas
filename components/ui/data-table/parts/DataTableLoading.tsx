"use client";

export interface DataTableLoadingProps {
  /** Column count — drives the number of skeleton blocks per row. */
  columnCount: number;
  /** Skeleton row count. Default 8. */
  rowCount?: number;
  /** Whether to render a leading checkbox cell. */
  hasSelection?: boolean;
  /** Match the body density for height parity. */
  density?: "compact" | "comfortable";
}

const heuristicWidths = ["w-1/2", "w-3/4", "w-2/3", "w-1/3", "w-4/5", "w-1/2"];

/**
 * Skeleton rows rendered while initial load is pending and there is no
 * existing data. After the first paint, refetches should keep the existing
 * rows and overlay a top progress bar instead (handled in DataTable).
 */
export function DataTableLoading({
  columnCount,
  rowCount = 8,
  hasSelection,
  density = "comfortable",
}: DataTableLoadingProps) {
  const cellHeight = density === "compact" ? "h-10" : "h-13";

  return (
    <>
      {Array.from({ length: rowCount }, (_, r) => (
        <tr
          key={r}
          className="border-b border-border-subtle"
          aria-hidden="true"
        >
          {hasSelection && (
            <td className={`px-4 ${cellHeight}`}>
              <div className="h-4 w-4 rounded bg-subtle animate-pulse" />
            </td>
          )}
          {Array.from({ length: columnCount }, (_, c) => (
            <td key={c} className={`px-4 ${cellHeight}`}>
              <div
                className={`h-3 rounded bg-subtle animate-pulse ${
                  heuristicWidths[c % heuristicWidths.length]
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Thin progress bar for in-place refetches (sort change, filter change,
 * pagination). Renders absolutely positioned so it sits at the top of the
 * body without taking layout space.
 */
export function DataTableRefetchBar() {
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-brand-500 opacity-80 animate-pulse"
    />
  );
}
