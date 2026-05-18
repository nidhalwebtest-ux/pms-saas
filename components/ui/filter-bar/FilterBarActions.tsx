"use client";

import Link from "next/link";
import { Button } from "../Button";
import type { FilterBarAction, FilterBarViewSwitcher } from "./types";

export interface FilterBarActionsProps {
  actions?: FilterBarAction[];
  view?: FilterBarViewSwitcher;
  className?: string;
}

export function FilterBarActions({ actions, view, className = "" }: FilterBarActionsProps) {
  if ((!actions || actions.length === 0) && !view) return null;

  return (
    <div className={`flex items-center gap-2 flex-shrink-0 ${className}`}>
      {view && <ViewSwitcher view={view} />}
      {actions?.map((a, i) => <ActionButton key={`${a.label}-${i}`} action={a} />)}
    </div>
  );
}

function ActionButton({ action }: { action: FilterBarAction }) {
  const variant = action.variant ?? "primary";
  const labelEl = (
    <span className={action.iconOnlyMobile ? "hidden sm:inline" : ""}>
      {action.label}
    </span>
  );

  if (action.href) {
    return (
      <Link href={action.href} className="inline-flex">
        <Button
          variant={variant}
          size="md"
          leftIcon={action.icon}
          disabled={action.disabled}
          loading={action.loading}
          onClick={(e) => e.preventDefault()}
          aria-label={action.iconOnlyMobile ? action.label : undefined}
        >
          {labelEl}
        </Button>
      </Link>
    );
  }
  return (
    <Button
      variant={variant}
      size="md"
      leftIcon={action.icon}
      disabled={action.disabled}
      loading={action.loading}
      onClick={action.onClick}
      aria-label={action.iconOnlyMobile ? action.label : undefined}
    >
      {labelEl}
    </Button>
  );
}

/* ============================================================================
 *  Segmented view switcher — e.g. table / cards / map.
 * ========================================================================= */

function ViewSwitcher({ view }: { view: FilterBarViewSwitcher }) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex bg-subtle border border-border-subtle rounded-lg p-0.5 gap-0.5"
    >
      {view.options.map((o) => {
        const active = o.id === view.value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => view.onChange(o.id)}
            className={
              "h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus " +
              (active
                ? "bg-surface text-fg shadow-sm"
                : "bg-transparent text-fg-secondary hover:text-fg")
            }
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
