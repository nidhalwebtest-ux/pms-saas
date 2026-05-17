"use client";

import Link from "next/link";
import { Button } from "../Button";
import type {
  EmptyStateAction,
  EmptyStateProps,
  EmptyStateSize,
  EmptyStateVariant,
} from "./types";

/* ============================================================================
 *  Variant + size tables — single source of truth for the visual treatment.
 * ========================================================================= */

const surface: Record<EmptyStateVariant, string> = {
  encouraging:
    "bg-surface border border-border-subtle",
  exploratory:
    "bg-surface border border-border-subtle",
  positive:
    "bg-surface border border-border-subtle",
  neutral:
    "bg-transparent border border-dashed border-border-default",
};

const containerPadding: Record<EmptyStateSize, string> = {
  sm: "py-6 px-4 gap-2.5",
  md: "py-12 px-6 gap-3.5",
  lg: "py-20 px-8 gap-[18px]",
};

const illustrationTileBase: Record<EmptyStateSize, string> = {
  sm: "h-12 w-12 rounded-[10px]",
  md: "h-20 w-20 rounded-[14px]",
  lg: "h-[140px] w-[140px] rounded-3xl",
};

const illustrationTileVariant: Record<EmptyStateVariant, string> = {
  encouraging: "bg-brand-50 text-brand-600",
  exploratory: "bg-subtle text-fg-tertiary",
  positive: "bg-success-50 text-success-600",
  neutral: "bg-transparent border border-dashed border-border-default text-fg-tertiary",
};

const titleSizeClass: Record<EmptyStateSize, string> = {
  sm: "text-[13.5px] font-semibold leading-snug",
  md: "text-base font-semibold leading-tight",
  lg: "text-[22px] font-semibold leading-tight tracking-[-0.015em]",
};

const titleVariantClass: Record<EmptyStateVariant, string> = {
  encouraging: "text-fg",
  exploratory: "text-fg-secondary",
  positive: "text-fg",
  neutral: "text-fg-secondary",
};

const descSizeClass: Record<EmptyStateSize, string> = {
  sm: "text-xs max-w-[38ch]",
  md: "text-sm max-w-[42ch]",
  lg: "text-sm max-w-[48ch]",
};

const innerIllustrationIconSize: Record<EmptyStateSize, string> = {
  sm: "[&>svg]:h-6 [&>svg]:w-6",
  md: "[&>svg]:h-10 [&>svg]:w-10",
  lg: "[&>svg]:h-16 [&>svg]:w-16",
};

/* ============================================================================
 *  Action button — uses the design-system Button for both flavors. When
 *  `href` is provided we render a Link that visually matches the same Button
 *  classes via the Button's element-flexible API.
 *
 *  Primary CTA presentation differs per variant:
 *  - encouraging / positive → filled brand primary
 *  - exploratory / neutral  → outlined secondary
 *  Secondary actions are always ghost-styled (link-look).
 * ========================================================================= */

function ActionButton({
  action,
  variant,
  isPrimary,
}: {
  action: EmptyStateAction;
  variant: EmptyStateVariant;
  isPrimary: boolean;
}) {
  const buttonVariant: "primary" | "secondary" | "ghost" = !isPrimary
    ? "ghost"
    : variant === "exploratory" || variant === "neutral"
      ? "secondary"
      : "primary";

  if (action.href) {
    return (
      <Link href={action.href} className="inline-block">
        <Button
          variant={buttonVariant}
          size="sm"
          leftIcon={action.icon}
          loading={action.loading}
          // The Link parent handles navigation; this button just wraps the visuals.
          onClick={(e) => e.preventDefault()}
        >
          {action.label}
        </Button>
      </Link>
    );
  }
  return (
    <Button
      variant={buttonVariant}
      size="sm"
      onClick={action.onClick}
      loading={action.loading}
      leftIcon={action.icon}
    >
      {action.label}
    </Button>
  );
}

/* ============================================================================
 *  Component
 * ========================================================================= */

export function EmptyState({
  variant = "encouraging",
  size = "md",
  illustration,
  title,
  description,
  titleAs,
  primaryAction,
  secondaryAction,
  inline,
  className = "",
  testId,
}: EmptyStateProps) {
  // Default heading: h2 for hero (lg), h3 otherwise.
  const Heading = titleAs ?? (size === "lg" ? "h2" : "h3");

  const rootClass = [
    "flex flex-col items-center text-center rounded-xl",
    inline ? "" : surface[variant],
    containerPadding[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const tileClass = [
    "flex items-center justify-center flex-shrink-0",
    illustrationTileBase[size],
    illustrationTileVariant[variant],
    innerIllustrationIconSize[size],
  ].join(" ");

  return (
    <div
      role="status"
      aria-live="polite"
      className={rootClass}
      data-testid={testId}
    >
      {illustration && <div className={tileClass}>{illustration}</div>}
      <Heading
        className={`${titleSizeClass[size]} ${titleVariantClass[variant]}`}
      >
        {title}
      </Heading>
      {description && (
        <p className={`${descSizeClass[size]} text-fg-tertiary`}>{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && (
            <ActionButton
              action={primaryAction}
              variant={variant}
              isPrimary
            />
          )}
          {secondaryAction && (
            <ActionButton
              action={secondaryAction}
              variant={variant}
              isPrimary={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
