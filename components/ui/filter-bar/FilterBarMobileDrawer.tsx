"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../modal";
import { Button } from "../Button";
import { FilterDispatch } from "./FilterBarAdvanced";
import type { FilterDef, QuickFilter } from "./types";

/* ============================================================================
 *  Mobile / tablet bottom-sheet drawer. Reuses the design-system Modal with
 *  variant="bottom-sheet" so focus trap, ESC dismissal, and motion are all
 *  inherited.
 *
 *  Contents:
 *  - VIEW group: condensed quick-tab list (if quickFilters provided)
 *  - One group per advanced filter — each filter type renders inline using
 *    the same FilterDispatch as the desktop bar, so behaviour matches
 *  - Footer: Reset (clears all advanced filters) + Apply (closes the drawer;
 *    nothing else — the filters apply on change, like desktop)
 * ========================================================================= */

export interface FilterBarMobileDrawerProps {
  open: boolean;
  onClose: () => void;

  quickFilters?: QuickFilter[];
  activeQuickFilter?: string;
  onQuickFilterChange?: (id: string) => void;

  filters?: FilterDef[];
  onClearAll?: () => void;

  title?: string;
  applyLabel?: string;
  resetLabel?: string;
}

export function FilterBarMobileDrawer({
  open,
  onClose,
  quickFilters,
  activeQuickFilter,
  onQuickFilterChange,
  filters,
  onClearAll,
  title = "Filters",
  applyLabel = "Apply",
  resetLabel = "Reset",
}: FilterBarMobileDrawerProps) {
  const visibleFilters = (filters ?? []).filter((f) => !f.hidden);
  const hasQuick = (quickFilters?.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="bottom-sheet"
      size="md"
      closeOnBackdrop
      closeOnEsc
    >
      <ModalHeader title={title} />
      <ModalBody>
        <div className="flex flex-col gap-4">
          {hasQuick && (
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[10.5px] uppercase tracking-wide text-fg-tertiary">
                View
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickFilters!.map((f) => {
                  const active = f.id === activeQuickFilter;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onQuickFilterChange?.(f.id)}
                      className={
                        "inline-flex items-center gap-1.5 whitespace-nowrap h-8 px-3 rounded-full border text-[12.5px] font-medium " +
                        (active
                          ? "bg-brand-500 border-brand-500 text-white"
                          : "bg-surface border-border-default text-fg-secondary")
                      }
                    >
                      <span>{f.label}</span>
                      {f.count !== undefined && (
                        <span
                          className={
                            "font-mono text-[10.5px] px-1.5 py-px rounded-full ltr-numbers " +
                            (active ? "bg-white/20 text-white" : "bg-subtle text-fg-secondary")
                          }
                        >
                          {f.count === "high" ? "500+" : f.count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {visibleFilters.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <p className="font-mono text-[10.5px] uppercase tracking-wide text-fg-tertiary">
                {f.label}
              </p>
              <FilterDispatch def={f} />
              {f.helpText && (
                <p className="text-xs text-fg-tertiary">{f.helpText}</p>
              )}
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter justify="between">
        <Button
          variant="ghost"
          onClick={() => {
            onClearAll?.();
          }}
          disabled={!onClearAll}
        >
          {resetLabel}
        </Button>
        <Button variant="primary" onClick={onClose}>
          {applyLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
