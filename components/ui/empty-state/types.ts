import type { ReactNode } from "react";

/**
 * Visual treatment — pick by user emotion, not by data shape.
 * - `encouraging`: first-time empties, onboarding (default).
 * - `exploratory`: filter / search returned zero.
 * - `positive`:    emptiness is the success (approval queue cleared).
 * - `neutral`:     selection prompts, inert placeholders.
 */
export type EmptyStateVariant =
  | "encouraging"
  | "exploratory"
  | "positive"
  | "neutral";

/** Sizing scale — sm for dropdowns, md for list pages (default), lg for hero. */
export type EmptyStateSize = "sm" | "md" | "lg";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  /** Renders as a link when provided. Mutually exclusive with `onClick`. */
  href?: string;
  icon?: ReactNode;
  /** Async pending state — disables and shows a spinner. */
  loading?: boolean;
}

export interface EmptyStateProps {
  /** Default `"encouraging"`. */
  variant?: EmptyStateVariant;

  /** Default `"md"`. */
  size?: EmptyStateSize;

  /**
   * ReactNode — accept an `<svg>`, a Heroicon, or any custom illustration.
   * Renders inside the tinted illustration tile. The tile's bg / text color
   * comes from the variant.
   */
  illustration?: ReactNode;

  /** Required. Renders as the configured heading level (`titleAs`). */
  title: string;

  /** Optional supporting copy — 1-2 short sentences. */
  description?: ReactNode;

  /** Heading level. Default `"h3"` (use `"h2"` for `size="lg"` heroes). */
  titleAs?: "h2" | "h3" | "h4";

  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;

  /** Drop the bordered surface — useful inside cards / drawers. */
  inline?: boolean;

  className?: string;
  testId?: string;
}
