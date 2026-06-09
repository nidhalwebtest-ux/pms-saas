import type { ReactNode } from "react";

/**
 * Semantic intent. Drives icon, palette, and screen-reader announcement.
 * - `info`         informational, neutral-positive context (blue)
 * - `success`      operation completed (green)
 * - `warning`      attention needed (amber) — assertive announce
 * - `error`        action failed or blocked (red) — assertive announce
 * - `neutral`      tip, system notice, no semantic weight (gray)
 * - `announcement` product news, marketing-tinted (brand)
 */
export type AlertVariant =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "announcement";

/** Sizing scale. Defaults to `"md"`. */
export type AlertSize = "sm" | "md" | "lg";

/**
 * Visual treatment.
 * - `subtle`   soft tinted background, light border (default — covers ~95% of cases)
 * - `outline`  no background, just a tinted border + icon
 * - `solid`    full-bleed coloured banner (header strips, hero banners)
 */
export type AlertAppearance = "subtle" | "outline" | "solid";

export interface AlertProps {
  /** Default `"info"`. */
  variant?: AlertVariant;

  /** Default `"md"`. */
  size?: AlertSize;

  /** Default `"subtle"`. */
  appearance?: AlertAppearance;

  /**
   * Optional short heading. Renders as a `<p>` with bold weight (Alerts are not
   * landmark regions, so heading semantics are intentionally avoided).
   */
  title?: ReactNode;

  /** Body copy. Accepts strings or rich JSX (links, inline `<code>`, etc). */
  description?: ReactNode;

  /**
   * Override the default variant icon. Pass `null` to suppress the icon entirely.
   * Accept any `ReactNode`; the Alert applies the right size + color via wrapper.
   */
  icon?: ReactNode | null;

  /**
   * Trailing action(s). Pass rendered `<Button>` elements — typically one
   * primary + one ghost. Stack vertically on `sm`, inline on `md`/`lg`.
   */
  actions?: ReactNode;

  /**
   * If true, render a dismiss button. Caller controls the lifecycle —
   * unmount the Alert in response to `onDismiss`.
   */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Default: localised "Dismiss". */
  dismissLabel?: string;

  /**
   * Override the auto-derived ARIA role. By default error/warning get `"alert"`
   * and other variants get `"status"`.
   */
  role?: "alert" | "status";

  /**
   * Override the auto-derived `aria-live` politeness. By default error/warning
   * are `"assertive"` and others are `"polite"`.
   */
  ariaLive?: "polite" | "assertive" | "off";

  /** Extra classes appended to the root. */
  className?: string;

  /** Optional test ID for QA. */
  testId?: string;

  /**
   * Free-form children. Renders **in place of** `title`/`description` when
   * provided — escape hatch for custom layouts (e.g. inline form-field list).
   */
  children?: ReactNode;
}
