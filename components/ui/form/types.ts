import type { ReactNode } from "react";

/**
 * Shared sizing scale for every text-like control in the form system.
 * - sm 32 px — dense filters, inline table edits
 * - md 38 px — default for forms and dialogs
 * - lg 44 px — hero search, marketing forms
 */
export type FieldSize = "sm" | "md" | "lg";

/**
 * Base props that every form field (TextField, TextArea, Select, …) accepts.
 * Atoms extend this with type-specific props (`leftIcon`, `options`, etc.).
 */
export interface BaseFieldProps {
  /** Visible label. Required — never use placeholder as a label. */
  label: ReactNode;

  /** Helper text shown below the control. Hidden when `error` is present. */
  helperText?: ReactNode;

  /**
   * Error message. A truthy string shows the red border AND the message.
   * Passing `true` shows the red border without a message (used when the
   * error is owned by a sibling component, e.g. a form-wide banner).
   */
  error?: string | boolean;

  /** Marks the field required: renders an asterisk + sets `aria-required`. */
  required?: boolean;

  /** Renders the word "optional" next to the label. Use sparingly. */
  showOptional?: boolean;

  /** Native `disabled` — removes from tab order. */
  disabled?: boolean;

  /** Native `readonly` — keeps in tab order, screen readers announce "read only". */
  readOnly?: boolean;

  /** Async-validation indicator — shows a spinner on the right side. */
  loading?: boolean;

  /** Shows a green border + check indicator. */
  success?: boolean;

  /** Sizing scale. Default: `"md"`. */
  size?: FieldSize;

  /** DOM id. Auto-generated via `useId()` when omitted. */
  id?: string;

  /** Form-field name (sent with form submission and to register()). */
  name?: string;

  /**
   * Extra class on the outer wrapper (NOT the control). Useful for layout
   * (`col-span-3`, etc.). For control-level styling, prefer the size prop.
   */
  className?: string;

  /**
   * Reserve vertical space for the message row to prevent layout shift when
   * an error appears. Default `true`. Disable for filter bars / inline edits.
   */
  reserveMessageSpace?: boolean;
}
