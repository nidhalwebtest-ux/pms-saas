import type { ReactNode } from "react";

/* ============================================================================
 *  Tabs — variant, size, orientation
 * ========================================================================= */

/**
 * Visual treatment.
 * - `underline` (default — ~90% of cases): brand-tinted 2 px bar on the
 *   trigger's baseline. No background. Use first.
 * - `pill`: white pill on a gray track. Use inside cards / modals where an
 *   underline would conflict with the parent surface.
 * - `boxed`: active tab visually connects to the panel below. Heavier; use
 *   sparingly (multi-document workspaces).
 */
export type TabsVariant = "underline" | "pill" | "boxed";

/** Sizing scale. */
export type TabsSize = "sm" | "md" | "lg";

export type TabsOrientation = "horizontal" | "vertical";

/* ============================================================================
 *  Count badge variant — drives the trigger's count pill palette.
 * ========================================================================= */

export type TabsCountVariant =
  | "neutral"
  | "destructive"
  | "warning"
  | "success";

/* ============================================================================
 *  Component props — thin shims over Radix Tabs so consumers get a typed,
 *  controlled API plus our visual props.
 * ========================================================================= */

export interface TabsProps {
  /** Controlled active value. */
  value: string;
  /** Fires when the user activates a different tab. */
  onValueChange: (v: string) => void;
  /** Default value when used uncontrolled. */
  defaultValue?: string;
  orientation?: TabsOrientation;
  /**
   * `manual` (default) — focus moves with arrows, activation requires
   * Enter / Space. Recommended when panel content is expensive.
   * `automatic` — focus + activation move together. Recommended for cheap
   * static content.
   */
  activationMode?: "manual" | "automatic";
  /** Override the inherited document direction. */
  dir?: "ltr" | "rtl";
  className?: string;
  children: ReactNode;
}

export interface TabsListProps {
  variant?: TabsVariant;
  size?: TabsSize;
  /** Stretch the strip to fill its parent. `pill` variant only. */
  fullWidth?: boolean;
  /** Allow horizontal scroll on overflow. Default `true`. */
  scrollOverflow?: boolean;
  /** Accessible label for the tablist. Inherits from `aria-labelledby` otherwise. */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export interface TabsTriggerProps {
  value: string;
  icon?: ReactNode;
  /** Optional count badge. Numbers above `countCeiling` render as e.g. `500+`. */
  count?: number;
  countVariant?: TabsCountVariant;
  countCeiling?: number;
  /** Red 6 × 6 dot at the top-end corner. Independent of `count`. */
  notification?: boolean;
  disabled?: boolean;
  /** Tooltip on hover/focus. Useful for icon-only triggers. */
  tooltip?: string;
  className?: string;
  children: ReactNode;
}

export interface TabsContentProps {
  value: string;
  /** Keep the panel mounted even when inactive. Default `false` — Radix's default behaviour. */
  forceMount?: boolean;
  className?: string;
  children: ReactNode;
}
