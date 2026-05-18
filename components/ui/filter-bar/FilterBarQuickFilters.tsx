"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import type { QuickFilter, QuickFilterStyle } from "./types";

/* ============================================================================
 *  Quick-filter tabs. WAI-ARIA tabs pattern — arrow keys cycle, Home/End jump.
 *  Two visual styles: `underline` (default) and `pill`.
 * ========================================================================= */

export interface FilterBarQuickFiltersProps {
  filters: QuickFilter[];
  active: string;
  onChange: (id: string) => void;
  style?: QuickFilterStyle;
  className?: string;
  /** Truncation ceiling for the `"high"` count pill. Default 500. */
  highCountCeiling?: number;
}

const countVariantClass = {
  default:     "bg-subtle text-fg-secondary",
  active:      "bg-brand-50 text-brand-700",
  destructive: "bg-error-50 text-error-700",
  warning:     "bg-warning-50 text-warning-700",
  success:     "bg-success-50 text-success-700",
} as const;

function CountBadge({
  count,
  variant,
  isActive,
  highCountCeiling,
  showDot,
}: {
  count: number | "high";
  variant?: QuickFilter["variant"];
  isActive: boolean;
  highCountCeiling: number;
  showDot: boolean;
}) {
  const display = count === "high" ? `${highCountCeiling}+` : count.toLocaleString();
  // Active state takes precedence over variant tinting, so the selected tab's
  // badge picks up the brand-tinted treatment.
  const cls =
    countVariantClass[
      isActive ? "active" : variant ?? "default"
    ];
  return (
    <span className={`inline-flex items-center gap-1 ${cls} font-mono text-[11px] leading-none px-1.5 py-1 rounded-full tabular-nums ltr-numbers`}>
      {showDot && count !== "high" && count > 0 && (
        <span className="inline-block size-1.5 rounded-full bg-error-500" aria-hidden="true" />
      )}
      {display}
    </span>
  );
}

export function FilterBarQuickFilters({
  filters,
  active,
  onChange,
  style = "underline",
  className = "",
  highCountCeiling = 500,
}: FilterBarQuickFiltersProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const idx = filters.findIndex((f) => f.id === active);
      if (idx < 0) return;
      let nextIdx: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIdx = (idx + 1) % filters.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIdx = (idx - 1 + filters.length) % filters.length;
      } else if (e.key === "Home") {
        nextIdx = 0;
      } else if (e.key === "End") {
        nextIdx = filters.length - 1;
      }
      if (nextIdx !== null) {
        e.preventDefault();
        onChange(filters[nextIdx].id);
        const btn = listRef.current?.querySelector<HTMLButtonElement>(
          `[data-tab-id="${filters[nextIdx].id}"]`,
        );
        btn?.focus();
      }
    },
    [filters, active, onChange],
  );

  if (style === "pill") {
    return (
      <div
        ref={listRef}
        role="tablist"
        aria-label="Quick filters"
        onKeyDown={handleKeyDown}
        className={`inline-flex gap-1.5 flex-nowrap overflow-x-auto ${className}`}
      >
        {filters.map((f) => {
          const isActive = f.id === active;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-tab-id={f.id}
              onClick={() => onChange(f.id)}
              className={
                "inline-flex items-center gap-1.5 whitespace-nowrap h-[30px] px-[11px] rounded-full border text-[12.5px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus " +
                (isActive
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-surface border-border-default text-fg-secondary hover:bg-subtle hover:border-border-strong")
              }
            >
              {f.icon}
              <span>{f.label}</span>
              {f.count !== undefined && (
                <CountBadge
                  count={f.count}
                  variant={f.variant}
                  isActive={isActive}
                  highCountCeiling={highCountCeiling}
                  showDot={Boolean(f.dotOnPositive)}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // underline style
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Quick filters"
      onKeyDown={handleKeyDown}
      className={`flex items-end border-b border-border-subtle overflow-x-auto -mx-[18px] px-[18px] ${className}`}
    >
      {filters.map((f) => {
        const isActive = f.id === active;
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-tab-id={f.id}
            onClick={() => onChange(f.id)}
            className={
              "relative h-10 px-3 -mb-px border-b-2 inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus focus-visible:rounded-md " +
              (isActive
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-fg-secondary hover:text-fg")
            }
          >
            {f.icon}
            <span>{f.label}</span>
            {f.count !== undefined && (
              <CountBadge
                count={f.count}
                variant={f.variant}
                isActive={isActive}
                highCountCeiling={highCountCeiling}
                showDot={Boolean(f.dotOnPositive)}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
