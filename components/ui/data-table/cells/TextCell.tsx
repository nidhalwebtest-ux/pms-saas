"use client";

import type { ReactNode } from "react";

export interface TextCellProps {
  children: ReactNode;
  /** Render in monospace (e.g. for reservation numbers, invoice numbers). */
  mono?: boolean;
  /** Make it muted (e.g. for secondary metadata). */
  muted?: boolean;
  /** Render an additional secondary line under the primary value. */
  subtitle?: ReactNode;
  /** Title attribute for hover-truncation tooltip. */
  title?: string;
}

/**
 * Plain text cell. Truncates with ellipsis if it overflows the cell width and
 * exposes the full text via the `title` attribute. The container is the cell
 * `<td>`, which the DataTable renders — this only owns the inner content.
 */
export function TextCell({
  children,
  mono,
  muted,
  subtitle,
  title,
}: TextCellProps) {
  const base = "truncate";
  const variant = [
    mono ? "font-mono text-[13px]" : "",
    muted ? "text-fg-tertiary" : "text-fg",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0" title={title}>
      <div className={`${base} ${variant}`}>{children}</div>
      {subtitle && (
        <div className="truncate text-xs text-fg-tertiary">{subtitle}</div>
      )}
    </div>
  );
}
