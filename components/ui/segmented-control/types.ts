import type { ReactNode } from "react";

/* ============================================================================
 *  Sizing scale
 *  - sm (default): FilterBar / toolbars / table headers
 *  - md:           Standalone inline switches — date range, rate type
 *  - lg:           Dashboard hero only
 * ========================================================================= */
export type SegmentedControlSize = "sm" | "md" | "lg";

/* ============================================================================
 *  Visual treatment
 *  - default: gray track, white-on-gray sliding pill
 *  - brand:   active segment becomes solid brand-500 (Dashboard hero)
 *  - ghost:   no surrounding container, brand-tinted active state
 * ========================================================================= */
export type SegmentedControlVariant = "default" | "brand" | "ghost";

export interface SegmentedControlOption<V extends string = string> {
  value: V;
  label?: string;
  icon?: ReactNode;
  /** Required when `label` is omitted (icon-only segments). */
  ariaLabel?: string;
  disabled?: boolean;
  tooltip?: string;
}

export interface SegmentedControlProps<V extends string = string> {
  /** Controlled value. */
  value: V;
  onValueChange: (v: V) => void;
  options: SegmentedControlOption<V>[];

  /** Default `"sm"`. */
  size?: SegmentedControlSize;
  /** Default `"default"`. */
  variant?: SegmentedControlVariant;

  /** Force equal-width segments. */
  equalWidth?: boolean;
  /**
   * Below this viewport width, hide labels and show icons only. Requires every
   * option to carry an `icon`. Pass `true` for the standard `640 px`
   * breakpoint or a custom px value.
   */
  collapseToIcons?: boolean | number;

  /** Accessible group label. Required unless `ariaLabelledby` is set. */
  ariaLabel?: string;
  ariaLabelledby?: string;

  className?: string;
  testId?: string;
}
