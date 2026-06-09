"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { variantIcon } from "./icons";
import type {
  AlertAppearance,
  AlertProps,
  AlertSize,
  AlertVariant,
} from "./types";

/* ============================================================================
 *  Variant tables — single source of truth for the visual treatment.
 *
 *  Subtle  → tinted bg + soft border (default form-level / inline)
 *  Outline → no bg, just border + icon
 *  Solid   → full saturation banner (heroes, top-of-page strips)
 * ========================================================================= */

const subtleSurface: Record<AlertVariant, string> = {
  info:         "bg-info-50 border-info-200 text-info-700",
  success:      "bg-success-50 border-success-200 text-success-700",
  warning:      "bg-warning-50 border-warning-200 text-warning-700",
  error:        "bg-error-50 border-error-200 text-error-700",
  neutral:      "bg-subtle border-border-subtle text-fg-secondary",
  announcement: "bg-brand-50 border-brand-200 text-brand-700",
};

const outlineSurface: Record<AlertVariant, string> = {
  info:         "bg-surface border-info-200 text-info-700",
  success:      "bg-surface border-success-200 text-success-700",
  warning:      "bg-surface border-warning-200 text-warning-700",
  error:        "bg-surface border-error-200 text-error-700",
  neutral:      "bg-surface border-border-default text-fg-secondary",
  announcement: "bg-surface border-brand-200 text-brand-700",
};

const solidSurface: Record<AlertVariant, string> = {
  info:         "bg-info-600 border-info-700 text-white",
  success:      "bg-success-600 border-success-700 text-white",
  warning:      "bg-warning-600 border-warning-700 text-white",
  error:        "bg-error-600 border-error-700 text-white",
  neutral:      "bg-gray-700 border-gray-800 text-white",
  announcement: "bg-brand-600 border-brand-700 text-white",
};

const iconColor: Record<AlertVariant, string> = {
  info:         "text-info-600",
  success:      "text-success-600",
  warning:      "text-warning-600",
  error:        "text-error-600",
  neutral:      "text-fg-tertiary",
  announcement: "text-brand-600",
};

/* ── Sizing ──────────────────────────────────────────────────────────────── */

const containerSize: Record<AlertSize, string> = {
  sm: "rounded-md px-3 py-2 gap-2",
  md: "rounded-lg px-4 py-3 gap-2.5",
  lg: "rounded-lg px-5 py-4 gap-3",
};

const iconSize: Record<AlertSize, string> = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
};

const titleSize: Record<AlertSize, string> = {
  sm: "text-sm font-semibold leading-snug",
  md: "text-sm font-semibold leading-snug",
  lg: "text-base font-semibold leading-snug",
};

const descriptionSize: Record<AlertSize, string> = {
  sm: "text-xs leading-normal",
  md: "text-sm leading-normal",
  lg: "text-sm leading-normal",
};

/* ── A11y defaults ───────────────────────────────────────────────────────── */

function defaultRole(variant: AlertVariant): "alert" | "status" {
  return variant === "error" || variant === "warning" ? "alert" : "status";
}
function defaultAriaLive(
  variant: AlertVariant,
): "polite" | "assertive" | "off" {
  return variant === "error" || variant === "warning" ? "assertive" : "polite";
}

/* ============================================================================
 *  Component
 * ========================================================================= */

export function Alert({
  variant = "info",
  size = "md",
  appearance = "subtle",
  title,
  description,
  icon,
  actions,
  dismissible = false,
  onDismiss,
  dismissLabel = "Dismiss",
  role,
  ariaLive,
  className = "",
  testId,
  children,
}: AlertProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // ESC dismisses when focus is inside the alert. Keep the handler stable; only
  // active while `dismissible` is true and an `onDismiss` is wired.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!dismissible || !onDismiss) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    },
    [dismissible, onDismiss],
  );

  // For solid appearance, icon and text take on the inverse colour treatment.
  const isSolid = appearance === "solid";

  const surface =
    appearance === "outline"
      ? outlineSurface[variant]
      : appearance === "solid"
        ? solidSurface[variant]
        : subtleSurface[variant];

  const rootClass = [
    "flex border",
    containerSize[size],
    surface,
    actions ? "items-start" : description ? "items-start" : "items-center",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const VariantIcon = variantIcon[variant];
  const renderedIcon =
    icon === null
      ? null
      : icon !== undefined
        ? icon
        : (
          <VariantIcon
            className={`${iconSize[size]} flex-shrink-0 ${
              isSolid ? "text-white/90" : iconColor[variant]
            }`}
            aria-hidden="true"
          />
        );

  const descriptionClass = [
    descriptionSize[size],
    isSolid
      ? "text-white/85"
      : variant === "neutral"
        ? "text-fg-secondary"
        : "text-fg-secondary",
    title ? "mt-0.5" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      role={role ?? defaultRole(variant)}
      aria-live={ariaLive ?? defaultAriaLive(variant)}
      onKeyDown={handleKeyDown}
      data-testid={testId}
      data-variant={variant}
      data-appearance={appearance}
      className={rootClass}
    >
      {renderedIcon && (
        <span
          className={`inline-flex flex-shrink-0 ${
            // Title-less alerts vertically centre the icon with the line;
            // multi-line bodies need a small nudge to line up with cap-height.
            description || actions ? "mt-0.5" : ""
          }`}
        >
          {renderedIcon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {children ?? (
          <>
            {title && (
              <p
                className={`${titleSize[size]} ${
                  isSolid ? "text-white" : "text-current"
                }`}
              >
                {title}
              </p>
            )}
            {description && <div className={descriptionClass}>{description}</div>}
            {actions && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={`flex-shrink-0 -m-1 p-1 rounded transition-colors focus:outline-none focus-visible:shadow-focus ${
            isSolid
              ? "text-white/80 hover:bg-white/10 hover:text-white"
              : "text-fg-tertiary hover:bg-black/[0.04] hover:text-fg-secondary"
          }`}
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
