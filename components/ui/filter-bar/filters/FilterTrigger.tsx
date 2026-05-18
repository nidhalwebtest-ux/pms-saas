"use client";

import { forwardRef, type ReactNode } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

/* ============================================================================
 *  Shared trigger button for advanced filters.
 *
 *  Visual states:
 *  - default:  white surface, gray border, label "Building:" in gray,
 *              value in dark gray.
 *  - active:   brand-tinted background + border + label + value (the filter is
 *              applied and differs from the "all" sentinel).
 *  - disabled: muted, no hover.
 *
 *  Optional `countBadge` prop renders a small pill (used by multi-select to
 *  show "+2" when more than one option is picked).
 * ========================================================================= */

export interface FilterTriggerProps {
  /** The filter's static label (e.g. "Building"). */
  label: string;
  /**
   * The currently selected value, formatted for display. When omitted, the
   * trigger reads as inactive even if the filter would otherwise show "All".
   */
  value?: string;
  /** Override the active state (e.g. multi-select with non-empty array). */
  active?: boolean;
  /** Small count pill rendered between value + chevron. */
  countBadge?: number;
  /** Controlled open state — drives the chevron rotation + active border. */
  open?: boolean;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Accessible properties applied by Headless UI's Popover.Button. */
  ariaProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** Class hook. */
  className?: string;
  /** id / data-testid pass-through. */
  id?: string;
}

const baseClass =
  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md " +
  "border border-border-default bg-surface text-[12.5px] leading-none " +
  "transition-colors duration-fast " +
  "hover:bg-subtle hover:border-border-strong " +
  "focus-visible:outline-none focus-visible:shadow-focus " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface disabled:hover:border-border-default";

const activeClass =
  "bg-brand-50 border-brand-400 text-brand-700";

export const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(
  function FilterTrigger(
    { label, value, active, countBadge, open, disabled, onClick, ariaProps, className = "", id },
    ref,
  ) {
    const isActive = active ?? false;

    const labelClass = isActive
      ? "text-brand-700 font-medium"
      : "text-fg-tertiary font-medium";
    const valueClass = isActive
      ? "text-brand-700 font-medium max-w-[160px] truncate"
      : "text-fg font-medium max-w-[160px] truncate";
    const chevClass = `h-3.5 w-3.5 ms-0.5 transition-transform duration-fast ${
      open ? "rotate-180" : ""
    } ${isActive ? "text-brand-500" : "text-fg-tertiary"}`;

    return (
      <button
        ref={ref}
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-expanded={open}
        {...ariaProps}
        className={[baseClass, isActive ? activeClass : "", className].join(" ")}
      >
        <span className={labelClass}>{label}:</span>
        <span className={valueClass}>{value ?? "All"}</span>
        {countBadge !== undefined && countBadge > 0 && (
          <span className="font-mono text-[10.5px] bg-brand-100 text-brand-700 px-1.5 py-px rounded-full ltr-numbers">
            +{countBadge}
          </span>
        )}
        <ChevronDownIcon className={chevClass} aria-hidden="true" />
      </button>
    );
  },
);

/* ============================================================================
 *  Popover panel wrapper — consistent surface + animation + a11y for the
 *  popover content rendered next to a FilterTrigger.
 * ========================================================================= */

export function FilterPopoverPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "absolute z-30 mt-1.5 inset-inline-start-0",
        "min-w-[240px] rounded-lg border border-border-default bg-surface shadow-lg",
        "p-3",
        "origin-top motion-safe:animate-[fade-in_140ms_ease-out]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* Standard Apply / Clear footer used by multi-select, date-range, number-range. */
export function FilterPanelFooter({
  onClear,
  onApply,
  clearLabel = "Clear",
  applyLabel = "Apply",
  clearDisabled,
  applyDisabled,
}: {
  onClear: () => void;
  onApply: () => void;
  clearLabel?: string;
  applyLabel?: string;
  clearDisabled?: boolean;
  applyDisabled?: boolean;
}) {
  return (
    <div className="mt-3 -mx-3 -mb-3 px-3 py-2 border-t border-border-subtle bg-subtle/40 rounded-b-lg flex justify-between items-center">
      <button
        type="button"
        onClick={onClear}
        disabled={clearDisabled}
        className="text-[12px] font-medium text-fg-secondary hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={applyDisabled}
        className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {applyLabel}
      </button>
    </div>
  );
}
