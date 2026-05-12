import type { FieldSize } from "./types";

/**
 * Shared control class tables for every text-like form input.
 * Sizes use arbitrary pixel values where the design-token spacing scale
 * doesn't expose 32 / 38 px directly (spacing 8 is overridden in this
 * project's tailwind.config.ts).
 */

export const controlBase =
  "w-full bg-surface text-fg border rounded-md " +
  "transition-colors duration-fast ease-out " +
  "placeholder:text-fg-tertiary " +
  "focus:outline-none " +
  "disabled:bg-subtle disabled:text-fg-disabled disabled:cursor-not-allowed " +
  "read-only:bg-subtle read-only:cursor-default";

export const controlSize: Record<FieldSize, string> = {
  sm: "h-[32px] text-[13px] px-2.5", // 32 px / 13 px / 10 px x-pad
  md: "h-[38px] text-sm px-3",        // 38 px / 14 px / 12 px x-pad
  lg: "h-11 text-md px-3.5",          // 44 px / 16 px / 14 px x-pad
};

/**
 * Textarea uses vertical padding instead of a fixed height (auto-resizes).
 * Horizontal padding matches the text-like sizes.
 */
export const textareaSize: Record<FieldSize, string> = {
  sm: "text-[13px] px-2.5 py-2",
  md: "text-sm px-3 py-2.5",
  lg: "text-md px-3.5 py-3",
};

export const borderState = {
  default: "border-border-default focus:border-brand-500 focus:shadow-focus",
  error:   "border-error-500 focus:shadow-focus-error",
  success: "border-success-500",
} as const;

/**
 * Padding offsets when icons / addons / clear button sit inside the control.
 * Apply on top of the size class.
 */
export const controlPaddingWithLeftIcon  = "ps-9";
export const controlPaddingWithRightIcon = "pe-9";

export const messageRowBase = "text-xs leading-snug";
export const messageRowReserved = "min-h-4";
export const messageVariant = {
  helper:  "text-fg-tertiary",
  error:   "text-error-600",
  success: "text-success-700",
} as const;

/**
 * Inline icon container — used inside text-like controls for left/right icons.
 * Positions absolute, doesn't capture pointer events.
 */
export const iconSlot =
  "absolute inset-y-0 flex items-center text-fg-tertiary pointer-events-none";
