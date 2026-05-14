"use client";

import { Badge } from "../../Badge";
import type { BadgeVariantProps } from "../../badge-helpers";

export interface StatusCellProps {
  /**
   * Pre-resolved badge variant props (from `getReservationStatusBadge`,
   * `resolveInvoiceBadge`, etc. in components/ui/badge-helpers).
   */
  variant?: BadgeVariantProps;
  /** Children — the visible label. */
  children: React.ReactNode;
}

/**
 * Status cell. Thin wrapper around `<Badge>` that fronts the badge helper
 * call-shape used everywhere else in the app: pass the spread-able variant
 * (tone + appearance + dot etc.) and the translated label as children. Keeps
 * column definitions terse:
 *
 *   cell: (info) => (
 *     <StatusCell variant={getReservationStatusBadge(info.row.original)}>
 *       {tStatus(info.row.original.statusKey)}
 *     </StatusCell>
 *   )
 */
export function StatusCell({ variant, children }: StatusCellProps) {
  return (
    <Badge {...(variant ?? { tone: "neutral", appearance: "subtle" })} size="sm">
      {children}
    </Badge>
  );
}
