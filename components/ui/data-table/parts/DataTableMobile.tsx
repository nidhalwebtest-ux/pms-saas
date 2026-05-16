"use client";

import { useMemo } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  flexRender,
  type Column,
  type Row,
  type Table,
} from "@tanstack/react-table";
import { Button } from "../../Button";
import type { RowAction, RowVariant, TableDensity } from "../types";

export interface DataTableMobileProps<T> {
  table: Table<T>;
  /** Whether selection is enabled — drives the checkbox-in-corner. */
  hasSelection: boolean;
  /** Whether rowActions were configured upstream. */
  hasActions: boolean;
  onRowClick?: (row: T) => void;
  rowVariant?: (row: T) => RowVariant;
  density: TableDensity;
  /** Strip out the two internal columns (selection + actions) before rendering cards. */
  internalColumnIds: ReadonlySet<string>;
  /** Resolves row actions on demand (same callback the desktop table uses). */
  rowActions?: (row: T) => RowAction<T>[];
}

const variantBorderClass: Record<RowVariant, string> = {
  default: "",
  urgent: "border-s-2 border-s-error-500",
  warning: "border-s-2 border-s-warning-500",
  inactive: "opacity-70",
  pinned: "border-s-2 border-s-warning-500",
};

/**
 * Mobile card list. Renders one card per row, ordered by the (possibly sorted)
 * TanStack row model. Column meta drives card layout:
 *   - `mobile: "title"`  — the large heading
 *   - `mobile: "status"` — the top-end pill
 *   - `mobile: "detail"` — labeled line in the card body
 *   - `mobile: "hide"`   — skipped
 *
 * The selection checkbox column and the row-actions column are stripped via
 * `internalColumnIds` — they reappear as a corner checkbox and a "⋯" menu.
 */
export function DataTableMobile<T>({
  table,
  hasSelection,
  hasActions,
  onRowClick,
  rowVariant,
  density,
  internalColumnIds,
  rowActions,
}: DataTableMobileProps<T>) {
  const rows = table.getRowModel().rows;

  // Sort dropdown sources: every sortable, non-internal column.
  const sortableColumns = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter(
          (c) => c.getCanSort() && !internalColumnIds.has(c.id),
        ),
    [table, internalColumnIds],
  );

  // Map columns into card slots once per row (memo at render time is fine —
  // the column list is stable for the lifetime of the table).
  const cardSlots = useMemo(() => {
    const visible = table
      .getAllLeafColumns()
      .filter((c) => !internalColumnIds.has(c.id));
    let title: Column<T, unknown> | undefined;
    let status: Column<T, unknown> | undefined;
    const details: Column<T, unknown>[] = [];
    for (const col of visible) {
      const role = (col.columnDef.meta?.mobile ?? "detail") as
        | "title"
        | "status"
        | "detail"
        | "hide";
      if (role === "hide") continue;
      if (role === "title" && !title) {
        title = col;
        continue;
      }
      if (role === "status" && !status) {
        status = col;
        continue;
      }
      details.push(col);
    }
    // Fallback: if no explicit title was declared, promote the first non-status
    // column to the title slot so every card has a heading.
    if (!title && details.length > 0) {
      title = details.shift();
    }
    // Sort details by mobilePriority (undefined sorts last, in declaration order).
    details.sort((a, b) => {
      const ap = a.columnDef.meta?.mobilePriority ?? Number.MAX_SAFE_INTEGER;
      const bp = b.columnDef.meta?.mobilePriority ?? Number.MAX_SAFE_INTEGER;
      return ap - bp;
    });
    return { title, status, details };
  }, [table, internalColumnIds]);

  return (
    <div>
      {sortableColumns.length > 0 && (
        <MobileSortBar table={table} columns={sortableColumns} />
      )}
      <ul className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <MobileCard
            key={row.id}
            row={row}
            slots={cardSlots}
            hasSelection={hasSelection}
            hasActions={hasActions}
            onRowClick={onRowClick}
            rowVariant={rowVariant}
            density={density}
            rowActions={rowActions}
          />
        ))}
      </ul>
    </div>
  );
}

/* ============================================================================
 *  Card
 * ========================================================================= */

interface MobileCardProps<T> {
  row: Row<T>;
  slots: {
    title?: Column<T, unknown>;
    status?: Column<T, unknown>;
    details: Column<T, unknown>[];
  };
  hasSelection: boolean;
  hasActions: boolean;
  onRowClick?: (row: T) => void;
  rowVariant?: (row: T) => RowVariant;
  density: TableDensity;
  rowActions?: (row: T) => RowAction<T>[];
}

function MobileCard<T>({
  row,
  slots,
  hasSelection,
  hasActions,
  onRowClick,
  rowVariant,
  density,
  rowActions,
}: MobileCardProps<T>) {
  const variant = rowVariant ? rowVariant(row.original) : "default";
  const isSelected = row.getIsSelected();
  const clickable = !!onRowClick;
  const pad = density === "compact" ? "px-3 py-2" : "px-4 py-3";

  function renderCellValue(col: Column<T, unknown>) {
    const cell = row.getAllCells().find((c) => c.column.id === col.id);
    if (!cell) return null;
    return flexRender(col.columnDef.cell, cell.getContext());
  }

  function handleCardClick() {
    if (clickable) onRowClick!(row.original);
  }

  return (
    <li
      className={`relative ${pad} ${variantBorderClass[variant]} ${
        isSelected ? "bg-brand-50/60" : ""
      } ${clickable ? "active:bg-subtle/60" : ""}`}
      onClick={clickable ? handleCardClick : undefined}
    >
      {/* Top row — selection checkbox, title slot space-grows, status, actions menu */}
      <div className="flex items-start gap-2">
        {hasSelection && (
          <input
            type="checkbox"
            aria-label="Select row"
            className="mt-1 h-4 w-4 rounded border-border-default text-brand-500 focus:ring-brand-300"
            checked={isSelected}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className="flex-1 min-w-0">
          {slots.title && (
            <div className="text-sm font-semibold text-fg truncate">
              {renderCellValue(slots.title)}
            </div>
          )}
        </div>
        {slots.status && (
          <div className="flex-shrink-0">{renderCellValue(slots.status)}</div>
        )}
        {hasActions && rowActions && (
          <CardActionsMenu actions={rowActions(row.original)} row={row.original} />
        )}
      </div>

      {/* Details */}
      {slots.details.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {slots.details.map((col) => {
            const label = col.columnDef.meta?.mobileLabel ?? col.columnDef.header;
            return (
              <DetailRow
                key={col.id}
                label={
                  typeof label === "string" || typeof label === "number" ? (
                    <>{label}</>
                  ) : (
                    flexRender(label, {} as never)
                  )
                }
                value={renderCellValue(col)}
              />
            );
          })}
        </dl>
      )}
    </li>
  );
}

function DetailRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-tertiary truncate">{label}</dt>
      <dd className="text-fg min-w-0 truncate">{value}</dd>
    </>
  );
}

/* ============================================================================
 *  Card actions menu — the "⋯" button on the top right of the card
 * ========================================================================= */

function CardActionsMenu<T>({
  actions,
  row,
}: {
  actions: RowAction<T>[];
  row: T;
}) {
  const visible = actions.filter((a) => a.visible !== false);
  if (visible.length === 0) return null;

  return (
    <Menu as="div" className="relative flex-shrink-0">
      <MenuButton
        aria-label="Row actions"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-20 min-w-[160px] rounded-md border border-border-subtle bg-surface shadow-lg py-1 text-sm focus:outline-none"
      >
        {visible.map((a) => (
          <MenuItem key={a.id}>
            {({ focus }) => (
              <button
                type="button"
                disabled={a.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick(row);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start ${
                  focus ? "bg-subtle" : ""
                } ${a.variant === "destructive" ? "text-error-600" : "text-fg"} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {a.icon && <span className="flex-shrink-0">{a.icon}</span>}
                <span>{a.label}</span>
              </button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/* ============================================================================
 *  Sort bar — pre-table strip with column picker + asc/desc toggle
 * ========================================================================= */

function MobileSortBar<T>({
  table,
  columns,
}: {
  table: Table<T>;
  columns: Column<T, unknown>[];
}) {
  const sorting = table.getState().sorting;
  const current = sorting[0];
  const currentId = current?.id ?? "";
  const currentDir = current?.desc ? "desc" : "asc";

  function applySort(id: string, desc: boolean) {
    if (!id) {
      table.setSorting([]);
      return;
    }
    table.setSorting([{ id, desc }]);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-subtle/40">
      <label className="text-xs text-fg-tertiary">Sort</label>
      <select
        value={currentId}
        onChange={(e) => applySort(e.target.value, currentDir === "desc")}
        className="h-7 rounded-md border border-border-default bg-surface text-xs px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        aria-label="Sort column"
      >
        <option value="">None</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {typeof c.columnDef.header === "string"
              ? c.columnDef.header
              : c.id}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="ghost"
        aria-label={currentDir === "asc" ? "Ascending" : "Descending"}
        onClick={() => applySort(currentId, currentDir === "asc")}
        disabled={!currentId}
        leftIcon={
          currentDir === "asc" ? (
            <ArrowUpIcon className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownIcon className="h-3.5 w-3.5" />
          )
        }
      >
        {currentDir === "asc" ? "Asc" : "Desc"}
      </Button>
    </div>
  );
}
