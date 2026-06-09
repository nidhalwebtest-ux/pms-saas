"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBarSearch } from "./FilterBarSearch";
import { FilterBarQuickFilters } from "./FilterBarQuickFilters";
import { FilterBarActions } from "./FilterBarActions";
import { FilterBarAdvanced, FilterBarAdvancedToggle } from "./FilterBarAdvanced";
import {
  FilterBarActiveFilters,
  buildActiveChips,
} from "./FilterBarActiveFilters";
import { FilterBarMobileDrawer } from "./FilterBarMobileDrawer";
import type { FilterBarProps } from "./types";

/* ============================================================================
 *  FilterBar — composed wrapper around search / tabs / dropdowns / chips /
 *  mobile drawer. Controlled — the parent owns every piece of filter state.
 *
 *  Layout breakpoints:
 *  - desktop  (>= collapseBelowPx, default 1024): all rows visible
 *  - tablet/mobile (< collapseBelowPx): search + tabs visible, advanced
 *    filters live behind a "Filters · N" trigger that opens the drawer
 * ========================================================================= */

export function FilterBar({
  search,
  quickFilters,
  activeQuickFilter,
  onQuickFilterChange,
  quickFilterStyle = "underline",
  filters,
  actions,
  activeFiltersDisplay = "chips",
  onClearAll,
  view,
  collapseBelowPx = 1024,
  className = "",
  testId,
}: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  // Track viewport against the configured breakpoint. Defaults to desktop on
  // SSR so the initial render is layout-stable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${collapseBelowPx - 1}px)`);
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [collapseBelowPx]);

  // Derived chips and counts run on every render — cheap, since the filter
  // array is short and identity-stable per the controlled API.
  const chips = useMemo(
    () => (filters ? buildActiveChips(filters) : []),
    [filters],
  );
  const activeCount = chips.length;

  const hasQuickTabs = (quickFilters?.length ?? 0) > 0 && activeQuickFilter !== undefined && onQuickFilterChange;
  const hasAdvanced  = (filters?.length ?? 0) > 0;

  const collapsedFiltersTrigger =
    hasAdvanced && isNarrow ? (
      <FilterBarAdvancedToggle
        activeCount={activeCount}
        onClick={() => setDrawerOpen(true)}
      />
    ) : null;

  return (
    <div
      data-testid={testId}
      className={`flex flex-col gap-3 px-3 sm:px-[18px] py-[14px] bg-surface border border-border-subtle rounded-t-xl ${className}`}
    >
      {/* Row 1 — search + collapsed trigger + actions */}
      {(search || actions || view || collapsedFiltersTrigger) && (
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {search && <FilterBarSearch search={search} />}
          {!search && <div className="flex-1 min-w-0" />}
          {collapsedFiltersTrigger}
          <FilterBarActions actions={actions} view={view} />
        </div>
      )}

      {/* Row 2 — quick tabs (desktop and tablet) */}
      {hasQuickTabs && (
        <FilterBarQuickFilters
          filters={quickFilters!}
          active={activeQuickFilter!}
          onChange={onQuickFilterChange!}
          style={quickFilterStyle}
        />
      )}

      {/* Row 3 — inline advanced filters (desktop only) */}
      {hasAdvanced && !isNarrow && (
        <FilterBarAdvanced filters={filters!} />
      )}

      {/* Row 4 — active chip row / summary line */}
      {activeFiltersDisplay !== "hidden" && chips.length > 0 && (
        <FilterBarActiveFilters
          chips={chips}
          display={activeFiltersDisplay}
          onClearAll={onClearAll}
        />
      )}

      {/* Mobile / tablet drawer */}
      {hasAdvanced && isNarrow && (
        <FilterBarMobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          quickFilters={quickFilters}
          activeQuickFilter={activeQuickFilter}
          onQuickFilterChange={onQuickFilterChange}
          filters={filters}
          onClearAll={onClearAll}
        />
      )}
    </div>
  );
}
