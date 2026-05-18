"use client";

import { format } from "date-fns";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ActiveFiltersDisplay, FilterDef } from "./types";

/* ============================================================================
 *  Active-filter chip row / summary line. Renders one chip per applied
 *  advanced filter; quick-filter selection is intentionally excluded — the
 *  underlined / pill tab already communicates that state.
 *
 *  Three display modes:
 *  - chips    one dismissible chip per active filter
 *  - summary  "N filters applied — Clear all" one-liner
 *  - hidden   nothing rendered (consumer relies on tinted trigger state)
 * ========================================================================= */

export interface ActiveChip {
  id: string;
  label: string;
  value: string;
  onClear: () => void;
}

export function buildActiveChips(filters: FilterDef[]): ActiveChip[] {
  const chips: ActiveChip[] = [];

  for (const f of filters) {
    if (f.hidden) continue;
    switch (f.type) {
      case "select": {
        const all = f.allValue ?? "all";
        if (f.value !== all) {
          const opt = f.options.find((o) => o.value === f.value);
          chips.push({
            id:    f.id,
            label: f.label,
            value: opt?.label ?? f.value,
            onClear: () => f.onChange(all),
          });
        }
        break;
      }
      case "multiSelect": {
        if (f.value.length > 0) {
          const first = f.options.find((o) => o.value === f.value[0])?.label ?? f.value[0];
          const extra = f.value.length - 1;
          chips.push({
            id:    f.id,
            label: f.label,
            value: extra > 0 ? `${first} +${extra}` : first,
            onClear: () => f.onChange([]),
          });
        }
        break;
      }
      case "dateRange": {
        const [from, to] = f.value;
        if (from || to) {
          const v =
            from && to ? `${format(from, "dd MMM")} – ${format(to, "dd MMM")}` :
            from       ? `≥ ${format(from, "dd MMM")}` :
                         `≤ ${format(to!, "dd MMM")}`;
          chips.push({
            id:    f.id,
            label: f.label,
            value: v,
            onClear: () => f.onChange([null, null]),
          });
        }
        break;
      }
      case "dateSingle": {
        if (f.value) {
          chips.push({
            id:    f.id,
            label: f.label,
            value: format(f.value, "dd MMM yyyy"),
            onClear: () => f.onChange(null),
          });
        }
        break;
      }
      case "numberRange": {
        const [min, max] = f.value;
        if (min !== null || max !== null) {
          const u = f.unit ? ` ${f.unit}` : "";
          const v =
            min !== null && max !== null ? `${min} – ${max}${u}` :
            min !== null                  ? `≥ ${min}${u}` :
                                            `≤ ${max}${u}`;
          chips.push({
            id:    f.id,
            label: f.label,
            value: v,
            onClear: () => f.onChange([null, null]),
          });
        }
        break;
      }
      case "text": {
        if (f.value.trim() !== "") {
          chips.push({
            id:    f.id,
            label: f.label,
            value: f.value.length > 18 ? `${f.value.slice(0, 18)}…` : f.value,
            onClear: () => f.onChange(""),
          });
        }
        break;
      }
      case "boolean": {
        if (f.value !== null) {
          const labels = f.labels ?? { on: "Yes", off: "No", any: "Any" };
          chips.push({
            id:    f.id,
            label: f.label,
            value: f.value ? labels.on : labels.off,
            onClear: () => f.onChange(null),
          });
        }
        break;
      }
      case "custom": {
        if (f.isActive) {
          chips.push({
            id:    f.id,
            label: f.label,
            value: f.displayValue,
            onClear: f.onClear,
          });
        }
        break;
      }
    }
  }
  return chips;
}

export interface FilterBarActiveFiltersProps {
  chips: ActiveChip[];
  display: ActiveFiltersDisplay;
  onClearAll?: () => void;
  className?: string;
}

export function FilterBarActiveFilters({
  chips,
  display,
  onClearAll,
  className = "",
}: FilterBarActiveFiltersProps) {
  if (display === "hidden" || chips.length === 0) return null;

  if (display === "summary") {
    return (
      <div className={`flex items-center gap-2 text-[12px] text-fg-secondary ${className}`}>
        <span>
          {chips.length} {chips.length === 1 ? "filter" : "filters"} applied
        </span>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-brand-600 hover:text-brand-700 underline underline-offset-[3px] font-medium"
          >
            Clear all
          </button>
        )}
      </div>
    );
  }

  // chips
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {chips.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1.5 ps-2.5 pe-1 py-0.5 rounded-full text-[12px] font-medium bg-brand-50 text-brand-700 border border-brand-200"
        >
          <span className="text-brand-500 font-normal">{c.label}:</span>
          <span>{c.value}</span>
          <button
            type="button"
            onClick={c.onClear}
            aria-label={`Remove ${c.label} filter`}
            className="size-[18px] rounded-full grid place-items-center text-brand-700 hover:bg-brand-200"
          >
            <XMarkIcon className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ms-1 text-[12px] font-medium text-brand-600 hover:text-brand-700 underline underline-offset-[3px]"
        >
          Clear all ({chips.length})
        </button>
      )}
    </div>
  );
}
