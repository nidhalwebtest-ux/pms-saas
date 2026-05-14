"use client";

import type { ReactNode } from "react";
import { InboxIcon } from "@heroicons/react/24/outline";
import { Button } from "../../Button";
import type { EmptyStateConfig } from "../types";

export interface DataTableEmptyProps {
  /**
   * Explicit empty-state config from the caller. Takes precedence over the
   * built-in default.
   */
  state?: EmptyStateConfig;
  /**
   * True when filters/search are active and the result is empty. Triggers
   * the "no matches" copy (different from a fresh table with zero data).
   */
  hasActiveFilters?: boolean;
  /** Caller can pass an action to clear filters when in the no-matches state. */
  onClearFilters?: () => void;
  /** Column count for `<td colspan>` so the empty cell stretches full width. */
  colspan: number;
}

/**
 * Empty state — rendered inside the table body. Two flavors:
 * - "No data yet" with optional CTA.
 * - "No matches for current filters" with optional Clear-filters action.
 */
export function DataTableEmpty({
  state,
  hasActiveFilters,
  onClearFilters,
  colspan,
}: DataTableEmptyProps) {
  // Resolve content. Caller-supplied state always wins.
  let title: ReactNode = state?.title;
  let description: ReactNode = state?.description;
  let illustration: ReactNode = state?.illustration;
  let action = state?.action;

  if (!state) {
    if (hasActiveFilters) {
      title = "No matches";
      description = "Try clearing or adjusting your filters.";
      if (onClearFilters) {
        action = { label: "Clear filters", onClick: onClearFilters };
      }
    } else {
      title = "No data yet";
    }
    illustration = <InboxIcon className="h-10 w-10 text-fg-tertiary" />;
  }

  return (
    <tr>
      <td colSpan={colspan} className="px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center gap-3">
          {illustration}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-fg">{title}</p>
            {description && (
              <p className="text-xs text-fg-tertiary max-w-sm">{description}</p>
            )}
          </div>
          {action && (
            <Button size="sm" variant="secondary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
