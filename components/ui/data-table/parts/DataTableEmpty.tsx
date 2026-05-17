"use client";

import type { ReactNode } from "react";
import { InboxIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { EmptyState } from "../../empty-state";

export interface DataTableEmptyProps {
  /**
   * Caller-supplied slot (typically a preset or an `<EmptyState>`). When
   * present, renders verbatim inside a full-width row.
   */
  slot?: ReactNode;
  /**
   * True when filters/search are active and the result is empty. Drives the
   * default fallback copy (no matches vs no data yet) when no slot was
   * supplied.
   */
  hasActiveFilters?: boolean;
  /** Column count for `<td colspan>` so the empty cell stretches full width. */
  colspan: number;
}

/**
 * Empty state — rendered inside the table body. When the caller passes an
 * `emptyState` (or `noResultsState`) slot, we just render it inside a single
 * full-width cell. Otherwise we fall back to the default i18n message via the
 * design-system `<EmptyState>`.
 */
export function DataTableEmpty({
  slot,
  hasActiveFilters,
  colspan,
}: DataTableEmptyProps) {
  const t = useTranslations("dataTable.empty");

  const content: ReactNode = slot ?? (
    <EmptyState
      variant={hasActiveFilters ? "exploratory" : "encouraging"}
      illustration={<InboxIcon />}
      title={hasActiveFilters ? t("noMatches") : t("noData")}
      description={hasActiveFilters ? t("noMatchesHint") : undefined}
      inline
    />
  );

  return (
    <tr>
      <td colSpan={colspan} className="px-4 py-8">
        {content}
      </td>
    </tr>
  );
}
