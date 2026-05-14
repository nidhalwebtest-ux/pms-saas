"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useDataTable } from "./hooks/useDataTable";
import { DataTableHeader } from "./parts/DataTableHeader";
import { DataTableRow } from "./parts/DataTableRow";
import { DataTablePagination } from "./parts/DataTablePagination";
import { DataTableToolbar } from "./parts/DataTableToolbar";
import { DataTableEmpty } from "./parts/DataTableEmpty";
import {
  DataTableLoading,
  DataTableRefetchBar,
} from "./parts/DataTableLoading";
import { DataTableError } from "./parts/DataTableError";
import { ActionsCell } from "./cells/ActionsCell";
import type { DataTableProps } from "./types";

/* ============================================================================
 *  Selection column — injected when selection.enabled is true.
 * ========================================================================= */

function buildSelectionColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: "__select",
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Select all rows on this page"
        className="h-4 w-4 rounded border-border-default text-brand-500 focus:ring-brand-300"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el)
            el.indeterminate =
              !table.getIsAllPageRowsSelected() &&
              table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Select row"
        className="h-4 w-4 rounded border-border-default text-brand-500 focus:ring-brand-300"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    size: 40,
    enableSorting: false,
    meta: { align: "center", sticky: "start" } as Record<string, unknown>,
  };
}

/* ============================================================================
 *  Row-actions column — injected when rowActions is supplied.
 * ========================================================================= */

function buildActionsColumn<T>(
  rowActions: (row: T) => ReturnType<typeof Array.from<unknown>> | unknown[],
): ColumnDef<T, unknown> {
  return {
    id: "__actions",
    header: "",
    cell: ({ row }) => (
      <ActionsCell row={row.original} actions={rowActions(row.original) as any} />
    ),
    size: 80,
    enableSorting: false,
    meta: { align: "end", sticky: "end" } as Record<string, unknown>,
  };
}

/* ============================================================================
 *  DataTable
 * ========================================================================= */

export function DataTable<T>({
  data,
  columns,
  getRowId,
  mode = "client",
  pagination,
  sorting,
  selection,
  bulkActions,
  rowActions,
  emptyState,
  hasActiveFilters,
  loading,
  error,
  onRowClick,
  rowVariant,
  density = "comfortable",
  stickyHeader = true,
  className = "",
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  /* ── Compose columns: selection + caller + actions ───────────────────── */

  const composedColumns = useMemo(() => {
    const cols: ColumnDef<T, any>[] = [];
    if (selection?.enabled) cols.push(buildSelectionColumn<T>());
    cols.push(...columns);
    if (rowActions) cols.push(buildActionsColumn<T>(rowActions as any));
    return cols;
  }, [columns, selection?.enabled, rowActions]);

  const { table } = useDataTable<T>({
    data,
    columns: composedColumns,
    mode,
    getRowId,
    sorting,
    pagination,
    selection,
  });

  /* ── Selection helpers for the toolbar ───────────────────────────────── */

  const selectedIds = useMemo(
    () => (selection?.selected ? [...selection.selected] : []),
    [selection?.selected],
  );
  const selectedRows = useMemo(() => {
    if (!selection?.enabled || selectedIds.length === 0) return [] as T[];
    const idSet = new Set(selectedIds);
    return data.filter((row, i) => idSet.has(getRowId ? getRowId(row) : String((row as any).id ?? i)));
  }, [data, selection?.enabled, selectedIds, getRowId]);

  const colspan = composedColumns.length;

  const hasData = data.length > 0;
  const showInitialLoading = loading && !hasData && !error;
  const showRefetchBar = loading && hasData;

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      className={`flex flex-col bg-surface border border-border-subtle rounded-lg overflow-hidden ${className}`}
    >
      {/* Bulk action bar — surfaces above the table when there is a selection */}
      {selection?.enabled && bulkActions && bulkActions.length > 0 && (
        <DataTableToolbar
          selectedIds={selectedIds}
          selectedRows={selectedRows}
          entityLabel={selection.entityLabel}
          onClear={() => selection.onSelectionChange(new Set())}
          actions={bulkActions}
        />
      )}

      {/* Scroll container */}
      <div className="relative overflow-x-auto">
        {showRefetchBar && <DataTableRefetchBar />}
        <table
          className="w-full text-sm"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
        >
          <DataTableHeader
            table={table}
            sticky={stickyHeader}
            density={density}
          />
          <tbody className={showRefetchBar ? "opacity-60" : ""}>
            {error ? (
              <DataTableError state={error} colspan={colspan} />
            ) : showInitialLoading ? (
              <DataTableLoading
                columnCount={composedColumns.length - (selection?.enabled ? 1 : 0)}
                hasSelection={selection?.enabled}
                density={density}
              />
            ) : hasData ? (
              table.getRowModel().rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  row={row}
                  density={density}
                  variant={rowVariant ? rowVariant(row.original) : "default"}
                  onClick={onRowClick}
                />
              ))
            ) : (
              <DataTableEmpty
                state={emptyState}
                hasActiveFilters={hasActiveFilters}
                colspan={colspan}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <DataTablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalCount={
            pagination.totalCount ??
            (mode === "client" ? data.length : data.length)
          }
          pageSizes={pagination.pageSizes}
          onPageChange={(next) =>
            pagination.onChange({
              pageIndex: next,
              pageSize: pagination.pageSize,
            })
          }
          onPageSizeChange={(size) =>
            pagination.onChange({ pageIndex: 0, pageSize: size })
          }
        />
      )}
    </div>
  );
}
