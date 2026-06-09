"use client";

import { flexRender, type Row } from "@tanstack/react-table";
import type { RowVariant, TableDensity } from "../types";

export interface DataTableRowProps<T> {
  row: Row<T>;
  density: TableDensity;
  variant: RowVariant;
  onClick?: (row: T) => void;
}

const variantClass: Record<RowVariant, string> = {
  default: "",
  urgent:
    "bg-error-50/30 shadow-[inset_3px_0_0_0_var(--error-500)] rtl:shadow-[inset_-3px_0_0_0_var(--error-500)]",
  warning:
    "bg-warning-50/30 shadow-[inset_3px_0_0_0_var(--warning-500)] rtl:shadow-[inset_-3px_0_0_0_var(--warning-500)]",
  inactive: "text-fg-tertiary",
  pinned:
    "shadow-[inset_3px_0_0_0_var(--warning-500)] rtl:shadow-[inset_-3px_0_0_0_var(--warning-500)]",
};

export function DataTableRow<T>({
  row,
  density,
  variant,
  onClick,
}: DataTableRowProps<T>) {
  const cellHeight = density === "compact" ? "h-10" : "h-13";

  const isSelected = row.getIsSelected();
  const clickable = !!onClick;

  const baseRow =
    "border-b border-border-subtle transition-colors duration-fast";
  const hover = "hover:bg-subtle/60";
  const clickableCls = clickable ? "cursor-pointer" : "";
  const selectedCls = isSelected
    ? "bg-brand-50/60 shadow-[inset_2px_0_0_0_var(--brand-500)] rtl:shadow-[inset_-2px_0_0_0_var(--brand-500)]"
    : "";

  return (
    <tr
      className={`${baseRow} ${hover} ${clickableCls} ${variantClass[variant]} ${selectedCls}`}
      onClick={clickable ? () => onClick!(row.original) : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        const meta = (cell.column.columnDef.meta ?? {}) as {
          align?: "start" | "center" | "end";
          numeric?: boolean;
          sticky?: "start" | "end";
        };
        const align =
          meta.align === "end"
            ? "text-end"
            : meta.align === "center"
            ? "text-center"
            : "text-start";
        const numeric = meta.numeric ? "tabular-nums" : "";
        const stickyClass =
          meta.sticky === "start"
            ? "sticky start-0 bg-surface"
            : meta.sticky === "end"
            ? "sticky end-0 bg-surface"
            : "";
        return (
          <td
            key={cell.id}
            className={`px-4 py-3 align-middle text-sm text-fg ${cellHeight} ${align} ${numeric} ${stickyClass}`}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}
