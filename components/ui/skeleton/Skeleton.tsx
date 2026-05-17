"use client";

import type { CSSProperties } from "react";
import type { SkeletonProps, SkeletonRounded } from "./types";

const radiusMap: Record<SkeletonRounded, string> = {
  none: "0",
  sm: "var(--skeleton-radius-sm)",
  md: "var(--skeleton-radius-md)",
  lg: "var(--skeleton-radius-lg)",
  pill: "var(--skeleton-radius-pill)",
};

/**
 * The atomic loading primitive. Renders a single tinted, opacity-pulsing
 * `<span>` that the compositor can animate on the GPU. All other skeleton
 * primitives compose this.
 *
 * `aria-hidden="true"` is set so screen readers don't read each shape — the
 * loading announcement is owned by the parent container (`<SkeletonCard>` or
 * a preset) via `role="status"` + `aria-live`.
 */
export function Skeleton({
  shape = "rect",
  width = "100%",
  height,
  rounded = "sm",
  className = "",
  animation = "pulse",
  testId,
}: SkeletonProps) {
  const style: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius: shape === "circle" ? "50%" : radiusMap[rounded],
    display: "block",
    // Animation is keyed on the `skeleton` class. Setting `animation: none`
    // inline wins over the class-level rule for opt-outs.
    ...(animation === "none" ? { animation: "none" } : {}),
  };

  return (
    <span
      className={`skeleton ${className}`}
      style={style}
      data-shape={shape}
      data-testid={testId}
      aria-hidden="true"
    />
  );
}
