"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "../../Button";
import { useConfirmDialog } from "../../confirm-dialog";
import type { BulkAction } from "../types";

export interface DataTableToolbarProps<T> {
  /** Selected row IDs (strings). */
  selectedIds: string[];
  /** Selected row objects. Used for action `visible()` predicates. */
  selectedRows: T[];
  /** Singular noun for pluralization. Default "row". */
  entityLabel?: string;
  /** Clear-selection callback. */
  onClear: () => void;
  /** Configured bulk actions. */
  actions: BulkAction<T>[];
}

/**
 * Bulk action bar. Appears only when `selectedIds.length > 0`. Renders a
 * count, a Deselect button, and one button per visible action. Destructive
 * actions optionally route through ConfirmDialog before firing.
 *
 * Sticky positioning is handled by the parent (DataTable) so this component
 * stays layout-agnostic.
 */
export function DataTableToolbar<T>({
  selectedIds,
  selectedRows,
  entityLabel = "row",
  onClear,
  actions,
}: DataTableToolbarProps<T>) {
  const confirm = useConfirmDialog();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const visibleActions = actions.filter((a) =>
    a.visible ? a.visible(selectedRows) : true,
  );

  async function runAction(action: BulkAction<T>) {
    if (action.confirm) {
      const { confirmed } = await confirm({
        title: action.confirm.title,
        description: action.confirm.description,
        tone: action.confirm.tone ?? "destructive",
        confirmLabel: action.confirm.confirmLabel ?? action.label,
        cancelLabel: action.confirm.cancelLabel,
      });
      if (!confirmed) return;
    }
    setPendingId(action.id);
    try {
      await action.onClick(selectedIds);
    } finally {
      setPendingId(null);
    }
  }

  const count = selectedIds.length;
  const pluralized = count === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-brand-50 border-b border-brand-200 text-sm">
      <span className="font-medium text-fg">
        <span className="tabular-nums">{count}</span> {pluralized} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-tertiary hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded"
      >
        <XMarkIcon className="h-3.5 w-3.5" />
        Deselect all
      </button>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {visibleActions.map((a) => {
          const isPending = pendingId === a.id;
          const disabled = pendingId !== null && pendingId !== a.id;
          return (
            <Button
              key={a.id}
              size="sm"
              variant={a.variant === "destructive" ? "destructive" : "secondary"}
              onClick={() => runAction(a)}
              loading={isPending}
              disabled={disabled}
              leftIcon={a.icon}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
