"use client";

import type { SkeletonCardProps } from "./types";

/**
 * Bordered surface that wraps a composed skeleton. Carries the loading
 * announcement (`role="status"` + `aria-live="polite"`) so the inner
 * primitives can stay `aria-hidden`. Inside a preset that already
 * announces, pass `announce={false}` so screen readers don't hear
 * "Loading" twice.
 */
export function SkeletonCard({
  padding = 24,
  bordered = true,
  announce = true,
  className = "",
  children,
  testId,
}: SkeletonCardProps) {
  const padStyle =
    typeof padding === "number" ? `${padding}px` : padding;

  return (
    <div
      className={`bg-surface rounded-lg ${bordered ? "border border-border-subtle" : ""} ${className}`}
      style={{ padding: padStyle }}
      role={announce ? "status" : undefined}
      aria-busy={announce ? true : undefined}
      aria-live={announce ? "polite" : undefined}
      aria-label={announce ? "Loading content" : undefined}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
