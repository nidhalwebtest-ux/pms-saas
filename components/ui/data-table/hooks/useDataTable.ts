"use client";

import { useMemo } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
} from "@tanstack/react-table";
import type { DataTableProps, TableMode } from "../types";

/* ----------------------------------------------------------------------------
 *  useDataTable — single place that wires TanStack across the three modes.
 * ------------------------------------------------------------------------- */

interface UseDataTableArgs<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  mode: TableMode;
  getRowId?: (row: T) => string;
  sorting?: DataTableProps<T>["sorting"];
  pagination?: DataTableProps<T>["pagination"];
  selection?: DataTableProps<T>["selection"];
}

export function useDataTable<T>({
  data,
  columns,
  mode,
  getRowId,
  sorting,
  pagination,
  selection,
}: UseDataTableArgs<T>) {
  /* ── Identity ─────────────────────────────────────────────────────────── */

  // Stable row id resolver — required for selection to survive sort/page.
  // Falls back to `row.id`, then to row index (selection will break if rows
  // reorder — log a warning in dev so consumers notice).
  const resolveRowId = useMemo(() => {
    if (getRowId) return getRowId;
    return (row: T, index: number, parent?: { id: string }) => {
      const r = row as { id?: string | number };
      if (r && (typeof r.id === "string" || typeof r.id === "number")) {
        return String(r.id);
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[DataTable] No getRowId and row.id is missing — falling back to index. Selection will misbehave under sort/pagination.",
        );
      }
      return parent ? `${parent.id}.${index}` : String(index);
    };
  }, [getRowId]);

  /* ── Selection bridge ────────────────────────────────────────────────── */

  // Convert the consumer's Set<string> into TanStack's Record<id, true>.
  const rowSelection: RowSelectionState = useMemo(() => {
    if (!selection?.enabled || !selection.selected) return {};
    const out: RowSelectionState = {};
    for (const id of selection.selected) out[id] = true;
    return out;
  }, [selection?.enabled, selection?.selected]);

  const onRowSelectionChange = (
    updater:
      | RowSelectionState
      | ((prev: RowSelectionState) => RowSelectionState),
  ) => {
    if (!selection?.enabled) return;
    const next =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const ids = new Set<string>();
    for (const [id, on] of Object.entries(next)) if (on) ids.add(id);
    selection.onSelectionChange(ids);
  };

  /* ── Sorting state ───────────────────────────────────────────────────── */

  // Controlled when consumer passes one in. Uncontrolled otherwise.
  const sortingState: SortingState | undefined = sorting?.state;

  /* ── Pagination state ────────────────────────────────────────────────── */

  // In "client" mode we let TanStack own pagination (when caller passed
  // pagination at all). In "server" mode the caller drives everything.
  const paginationState =
    pagination !== undefined
      ? { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize }
      : undefined;

  /* ── Build TanStack options ──────────────────────────────────────────── */

  const isServer = mode === "server";
  const isVirtual = mode === "virtual";

  const options: TableOptions<T> = {
    data,
    columns,
    getRowId: resolveRowId,
    getCoreRowModel: getCoreRowModel(),

    // Sorting: client gets the sorted row model; server/virtual sort upstream
    // and just receive sorted data.
    ...(isServer || isVirtual
      ? { manualSorting: true }
      : { getSortedRowModel: getSortedRowModel() }),

    // Pagination: only "client" mode uses TanStack's pagination row model.
    // "server" mode is manual; "virtual" mode skips pagination entirely.
    ...(mode === "client" && pagination !== undefined
      ? { getPaginationRowModel: getPaginationRowModel() }
      : { manualPagination: true }),

    state: {
      ...(sortingState ? { sorting: sortingState } : {}),
      ...(paginationState ? { pagination: paginationState } : {}),
      ...(selection?.enabled ? { rowSelection } : {}),
    },

    // Sort change → forward to caller-controlled handler if present.
    ...(sorting
      ? {
          onSortingChange: sorting.onChange,
          enableMultiSort: sorting.multiSort ?? false,
        }
      : {}),

    // Pagination change → forward to caller-controlled handler.
    ...(pagination
      ? {
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({
                    pageIndex: pagination.pageIndex,
                    pageSize: pagination.pageSize,
                  })
                : updater;
            pagination.onChange({
              pageIndex: next.pageIndex,
              pageSize: next.pageSize,
            });
          },
        }
      : {}),

    // Server-side row count for pager rendering.
    ...(isServer && pagination?.totalCount !== undefined
      ? { rowCount: pagination.totalCount }
      : {}),

    // Selection bridge.
    ...(selection?.enabled
      ? {
          enableRowSelection: selection.isRowSelectable
            ? (row) => selection.isRowSelectable!(row.original)
            : true,
          onRowSelectionChange,
        }
      : { enableRowSelection: false }),
  };

  const table = useReactTable(options);

  return { table };
}
