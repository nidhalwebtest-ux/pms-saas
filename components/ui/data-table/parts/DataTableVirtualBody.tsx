"use client";

import { useEffect, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Table } from "@tanstack/react-table";
import { DataTableRow } from "./DataTableRow";
import type { RowVariant, TableDensity } from "../types";

export interface DataTableVirtualBodyProps<T> {
  table: Table<T>;
  scrollRef: RefObject<HTMLDivElement | null>;
  density: TableDensity;
  rowHeight: number;
  onRowClick?: (row: T) => void;
  rowVariant?: (row: T) => RowVariant;
  /** Column count — needed to size the spacer rows correctly. */
  colspan: number;
  /** Infinite-scroll callback fired once per "near the end" arrival. */
  onEndReached?: () => void;
  /** Distance in rows from the end that triggers `onEndReached`. */
  endReachedThreshold?: number;
}

/**
 * Virtualized tbody. Uses spacer rows (one before, one after) to preserve
 * `<table>` semantics — TanStack-Virtual's recommended approach for tables.
 * The visible rows render at their natural document position; the spacers
 * provide the scroll height the virtualizer needs.
 */
export function DataTableVirtualBody<T>({
  table,
  scrollRef,
  density,
  rowHeight,
  onRowClick,
  rowVariant,
  colspan,
  onEndReached,
  endReachedThreshold = 5,
}: DataTableVirtualBodyProps<T>) {
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Infinite scroll trigger — fire once when the last visible index gets
  // within `endReachedThreshold` of the data end. Re-fires only after the
  // data array grows (rows.length changes).
  useEffect(() => {
    if (!onEndReached || rows.length === 0) return;
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - endReachedThreshold - 1) {
      onEndReached();
    }
    // We deliberately key on rows.length, not the items themselves — repeated
    // scrolls inside the same dataset should not re-trigger the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const padTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const padBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1]!.end
      : 0;

  return (
    <>
      {padTop > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colspan} style={{ height: padTop, padding: 0 }} />
        </tr>
      )}
      {virtualItems.map((vi) => {
        const row = rows[vi.index]!;
        return (
          <DataTableRow
            key={row.id}
            row={row}
            density={density}
            variant={rowVariant ? rowVariant(row.original) : "default"}
            onClick={onRowClick}
          />
        );
      })}
      {padBottom > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colspan} style={{ height: padBottom, padding: 0 }} />
        </tr>
      )}
    </>
  );
}
