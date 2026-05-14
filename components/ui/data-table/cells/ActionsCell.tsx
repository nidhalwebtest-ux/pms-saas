"use client";

import { useState, type MouseEvent } from "react";
import { Spinner } from "../../Spinner";
import type { RowAction } from "../types";

export interface ActionsCellProps<T> {
  row: T;
  actions: RowAction<T>[];
}

/**
 * Row actions cell. Renders inline icon buttons for each visible action. Each
 * button stops click propagation so the row-click handler (e.g. navigate to
 * detail) does not also fire.
 *
 * Hidden actions vanish entirely. Disabled actions render dimmed. Async
 * actions render a spinner in place of their icon while pending.
 */
export function ActionsCell<T>({ row, actions }: ActionsCellProps<T>) {
  const visible = actions.filter((a) => a.visible !== false);

  if (visible.length === 0) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {visible.map((a) => (
        <ActionButton key={a.id} action={a} row={row} />
      ))}
    </div>
  );
}

function ActionButton<T>({ action, row }: { action: RowAction<T>; row: T }) {
  const [pending, setPending] = useState(false);

  async function handle(e: MouseEvent) {
    e.stopPropagation();
    if (action.disabled || pending) return;
    const result = action.onClick(row);
    if (result instanceof Promise) {
      setPending(true);
      try {
        await result;
      } finally {
        setPending(false);
      }
    }
  }

  const base =
    "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";
  const tone =
    action.variant === "destructive"
      ? "text-fg-tertiary hover:bg-error-50 hover:text-error-600"
      : "text-fg-tertiary hover:bg-subtle hover:text-fg";

  return (
    <button
      type="button"
      onClick={handle}
      disabled={action.disabled || pending}
      aria-label={action.label}
      title={action.label}
      className={`${base} ${tone}`}
    >
      {pending ? <Spinner size={14} /> : action.icon}
    </button>
  );
}
