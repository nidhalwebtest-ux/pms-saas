import type { ReactNode } from "react";

/* ============================================================================
 *  Shared
 * ========================================================================= */

export interface Option {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  group?: string;
  disabled?: boolean;
}

/* ============================================================================
 *  Search
 * ========================================================================= */

export interface SearchProp {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Default 300 ms. Set 0 to fire immediately. */
  debounceMs?: number;
  /** Show ⌘K keyboard hint. Default `false` (hint is desktop-only nicety). */
  shortcut?: boolean;
}

/* ============================================================================
 *  Quick filter tabs
 * ========================================================================= */

export type QuickFilterCountVariant =
  | "default"
  | "active"
  | "destructive"
  | "warning"
  | "success";

export interface QuickFilter {
  id: string;
  label: string;
  /** Number, or `"high"` for the `500+` truncation pill. */
  count?: number | "high";
  variant?: Exclude<QuickFilterCountVariant, "active" | "default">;
  icon?: ReactNode;
  /** Show a red dot adjacent to the count when count > 0. */
  dotOnPositive?: boolean;
}

export type QuickFilterStyle = "underline" | "pill";

/* ============================================================================
 *  Date presets
 * ========================================================================= */

export type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "last-30"
  | "last-90"
  | "khareef-season"
  | "ytd"
  | "custom";

/* ============================================================================
 *  Filter definitions — discriminated union
 * ========================================================================= */

interface FilterBase {
  id: string;
  label: string;
  helpText?: string;
  /** Hide the filter from the bar but keep its value in state. */
  hidden?: boolean;
  /** Mark trigger as disabled (e.g. globally-scoped property). */
  disabled?: boolean;
}

export interface SelectFilterDef extends FilterBase {
  type: "select";
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  /** Sentinel value meaning "no filter applied". Default `"all"`. */
  allValue?: string;
}

export interface MultiSelectFilterDef extends FilterBase {
  type: "multiSelect";
  value: string[];
  onChange: (v: string[]) => void;
  options: Option[];
}

export interface DateRangeFilterDef extends FilterBase {
  type: "dateRange";
  value: [Date | null, Date | null];
  onChange: (v: [Date | null, Date | null]) => void;
  presets?: DatePreset[] | "all";
}

export interface DateSingleFilterDef extends FilterBase {
  type: "dateSingle";
  value: Date | null;
  onChange: (v: Date | null) => void;
}

export interface NumberRangeFilterDef extends FilterBase {
  type: "numberRange";
  value: [number | null, number | null];
  onChange: (v: [number | null, number | null]) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}

export interface TextFilterDef extends FilterBase {
  type: "text";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export interface BooleanFilterDef extends FilterBase {
  type: "boolean";
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  labels?: { on: string; off: string; any: string };
}

export interface CustomFilterDef extends FilterBase {
  type: "custom";
  isActive: boolean;
  displayValue: string;
  render: (ctx: { close: () => void }) => ReactNode;
  onClear: () => void;
}

export type FilterDef =
  | SelectFilterDef
  | MultiSelectFilterDef
  | DateRangeFilterDef
  | DateSingleFilterDef
  | NumberRangeFilterDef
  | TextFilterDef
  | BooleanFilterDef
  | CustomFilterDef;

/* ============================================================================
 *  Actions + view switcher
 * ========================================================================= */

export interface FilterBarAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Hide the label below sm — keeps only the icon. */
  iconOnlyMobile?: boolean;
}

export interface FilterBarViewSwitcher {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string; icon?: ReactNode }[];
}

/* ============================================================================
 *  FilterBar root
 * ========================================================================= */

export type ActiveFiltersDisplay = "chips" | "summary" | "hidden";

export interface FilterBarProps {
  search?: SearchProp;

  quickFilters?: QuickFilter[];
  activeQuickFilter?: string;
  onQuickFilterChange?: (id: string) => void;
  quickFilterStyle?: QuickFilterStyle;

  filters?: FilterDef[];

  actions?: FilterBarAction[];

  activeFiltersDisplay?: ActiveFiltersDisplay;
  onClearAll?: () => void;

  view?: FilterBarViewSwitcher;

  /** Breakpoint (px) below which advanced filters collapse to the drawer. Default 1024. */
  collapseBelowPx?: number;

  className?: string;
  testId?: string;
}
