"use client";

import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import {
  SelectFilter,
  MultiSelectFilter,
  DateRangeFilter,
  DateSingleFilter,
  NumberRangeFilter,
  TextFilter,
  BooleanFilter,
  CustomFilter,
} from "./filters";
import type { FilterDef } from "./types";

/* ============================================================================
 *  Renders a single filter definition. The dispatcher keeps the consumer
 *  agnostic to which renderer maps to which type.
 * ========================================================================= */
export function FilterDispatch({ def }: { def: FilterDef }) {
  if (def.hidden) return null;
  switch (def.type) {
    case "select":      return <SelectFilter def={def} />;
    case "multiSelect": return <MultiSelectFilter def={def} />;
    case "dateRange":   return <DateRangeFilter def={def} />;
    case "dateSingle":  return <DateSingleFilter def={def} />;
    case "numberRange": return <NumberRangeFilter def={def} />;
    case "text":        return <TextFilter def={def} />;
    case "boolean":     return <BooleanFilter def={def} />;
    case "custom":      return <CustomFilter def={def} />;
  }
}

/* ============================================================================
 *  Inline row of advanced filters (desktop view). At narrower breakpoints the
 *  parent renders the mobile drawer instead.
 * ========================================================================= */
export interface FilterBarAdvancedProps {
  filters: FilterDef[];
  className?: string;
}

export function FilterBarAdvanced({ filters, className = "" }: FilterBarAdvancedProps) {
  const visible = filters.filter((f) => !f.hidden);
  if (visible.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {visible.map((f) => <FilterDispatch key={f.id} def={f} />)}
    </div>
  );
}

/* ============================================================================
 *  Tablet / mobile collapsed trigger — "Filters · 2" button.
 * ========================================================================= */
export function FilterBarAdvancedToggle({
  activeCount,
  onClick,
  label = "Filters",
}: {
  activeCount: number;
  onClick: () => void;
  label?: string;
}) {
  const isActive = activeCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12.5px] font-medium leading-none transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus flex-shrink-0 " +
        (isActive
          ? "bg-brand-50 border-brand-400 text-brand-700"
          : "bg-surface border-border-default text-fg-secondary hover:bg-subtle hover:border-border-strong")
      }
    >
      <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      {activeCount > 0 && (
        <span className="font-mono text-[10.5px] bg-brand-100 text-brand-700 px-1.5 py-px rounded-full ltr-numbers">
          {activeCount}
        </span>
      )}
    </button>
  );
}
