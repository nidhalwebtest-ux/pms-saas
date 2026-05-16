"use client";

import { Fragment, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { useDataTable } from "./hooks/useDataTable";
import { useIsMobile } from "./hooks/useIsMobile";
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
import { DataTableMobile } from "./parts/DataTableMobile";
import { DataTableVirtualBody } from "./parts/DataTableVirtualBody";
import { ActionsCell } from "./cells/ActionsCell";
import { ExclamationCircleIcon, InboxIcon } from "@heroicons/react/24/outline";
import { Button } from "../Button";
import type { DataTableProps } from "./types";

/* ============================================================================
 *  Selection column — injected when selection.enabled is true.
 * ========================================================================= */

function buildSelectionColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: "__select",
    header: ({ table }) => <HeaderSelectCheckbox table={table} />,
    cell: ({ row }) => <RowSelectCheckbox row={row} />,
    size: 40,
    enableSorting: false,
    meta: { align: "center", sticky: "start" } as Record<string, unknown>,
  };
}

function HeaderSelectCheckbox<T>({ table }: { table: import("@tanstack/react-table").Table<T> }) {
  const t = useTranslations("dataTable.header");
  return (
    <input
      type="checkbox"
      aria-label={t("selectAllAriaLabel")}
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
  );
}

function RowSelectCheckbox<T>({ row }: { row: import("@tanstack/react-table").Row<T> }) {
  const t = useTranslations("dataTable.header");
  return (
    <input
      type="checkbox"
      aria-label={t("selectRowAriaLabel")}
      className="h-4 w-4 rounded border-border-default text-brand-500 focus:ring-brand-300"
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onChange={row.getToggleSelectedHandler()}
      onClick={(e) => e.stopPropagation()}
    />
  );
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
  renderRow,
  density = "comfortable",
  stickyHeader = true,
  mobileBreakpoint = 768,
  virtualMaxHeight = "600px",
  virtualRowHeight,
  onEndReached,
  endReachedThreshold,
  className = "",
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const isMobile = useIsMobile(mobileBreakpoint);
  const isVirtual = mode === "virtual";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tEmpty = useTranslations("dataTable.empty");
  const tError = useTranslations("dataTable.error");

  /* ── Compose columns: selection + caller + actions ───────────────────── */

  const composedColumns = useMemo(() => {
    const cols: ColumnDef<T, any>[] = [];
    if (selection?.enabled) cols.push(buildSelectionColumn<T>());
    cols.push(...columns);
    if (rowActions) cols.push(buildActionsColumn<T>(rowActions as any));
    return cols;
  }, [columns, selection?.enabled, rowActions]);

  const internalColumnIds = useMemo(
    () => new Set<string>(["__select", "__actions"]),
    [],
  );

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
          selectionLabel={selection.selectionLabel}
          onClear={() => selection.onSelectionChange(new Set())}
          actions={bulkActions}
        />
      )}

      {/* Body — switches between table and mobile card list */}
      {isMobile ? (
        <div className="relative" aria-busy={loading || undefined}>
          {showRefetchBar && <DataTableRefetchBar />}
          <div className={showRefetchBar ? "opacity-60" : ""}>
            {error ? (
              <MobileMessage>
                <ExclamationCircleIcon className="h-8 w-8 text-error-500" />
                <p className="text-sm text-fg max-w-sm">{error.message}</p>
                {error.onRetry && (
                  <Button size="sm" variant="secondary" onClick={error.onRetry}>
                    {tError("retry")}
                  </Button>
                )}
              </MobileMessage>
            ) : showInitialLoading ? (
              <ul className="divide-y divide-border-subtle">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="px-4 py-3 space-y-2" aria-hidden="true">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1/3 rounded bg-subtle animate-pulse" />
                      <div className="ms-auto h-4 w-12 rounded bg-subtle animate-pulse" />
                    </div>
                    <div className="h-3 w-1/2 rounded bg-subtle animate-pulse" />
                    <div className="h-3 w-1/4 rounded bg-subtle animate-pulse" />
                  </li>
                ))}
              </ul>
            ) : hasData ? (
              <DataTableMobile
                table={table}
                hasSelection={!!selection?.enabled}
                hasActions={!!rowActions}
                onRowClick={onRowClick}
                rowVariant={rowVariant}
                density={density}
                internalColumnIds={internalColumnIds}
                rowActions={rowActions}
              />
            ) : (
              <MobileMessage>
                <InboxIcon className="h-10 w-10 text-fg-tertiary" />
                <p className="text-sm font-semibold text-fg">
                  {emptyState?.title ??
                    (hasActiveFilters ? tEmpty("noMatches") : tEmpty("noData"))}
                </p>
                {emptyState?.description && (
                  <p className="text-xs text-fg-tertiary max-w-sm">
                    {emptyState.description}
                  </p>
                )}
                {emptyState?.action && (
                  <Button size="sm" variant="secondary" onClick={emptyState.action.onClick}>
                    {emptyState.action.label}
                  </Button>
                )}
              </MobileMessage>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={isVirtual ? scrollRef : undefined}
          className="relative overflow-x-auto"
          style={
            isVirtual
              ? {
                  maxHeight:
                    typeof virtualMaxHeight === "number"
                      ? `${virtualMaxHeight}px`
                      : virtualMaxHeight,
                  overflowY: "auto",
                }
              : undefined
          }
        >
          {showRefetchBar && <DataTableRefetchBar />}
          <table
            className="w-full text-sm"
            aria-label={ariaLabel}
            aria-busy={loading || undefined}
            aria-rowcount={isVirtual ? data.length : undefined}
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
                isVirtual ? (
                  <DataTableVirtualBody
                    table={table}
                    scrollRef={scrollRef}
                    density={density}
                    rowHeight={
                      virtualRowHeight ?? (density === "compact" ? 40 : 52)
                    }
                    onRowClick={onRowClick}
                    rowVariant={rowVariant}
                    colspan={colspan}
                    onEndReached={onEndReached}
                    endReachedThreshold={endReachedThreshold}
                  />
                ) : (
                  table.getRowModel().rows.map((row, index) => {
                    if (renderRow) {
                      const override = renderRow({ row: row.original, index });
                      if (override !== null && override !== undefined) {
                        return <Fragment key={row.id}>{override}</Fragment>;
                      }
                    }
                    return (
                      <DataTableRow
                        key={row.id}
                        row={row}
                        density={density}
                        variant={rowVariant ? rowVariant(row.original) : "default"}
                        onClick={onRowClick}
                      />
                    );
                  })
                )
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
      )}

      {/* Pagination — hidden in virtual mode (infinite scroll instead) */}
      {pagination && !isVirtual && (
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

function MobileMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 px-4 py-16">
      {children}
    </div>
  );
}
