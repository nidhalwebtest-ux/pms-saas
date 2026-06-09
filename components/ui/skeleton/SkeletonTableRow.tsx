"use client";

import { SkeletonCircle } from "./SkeletonCircle";
import { SkeletonLine } from "./SkeletonLine";
import { SkeletonRectangle } from "./SkeletonRectangle";
import type { SkeletonTableRowProps } from "./types";

/**
 * Skeleton `<tr>` for use inside a real `<table>`. The column `width` and
 * `align` should mirror the real DataTable columns 1:1 so the layout doesn't
 * shift when data arrives. The `type` hint picks a richer cell renderer:
 *
 *  - `default`  → a single 70%-width line (the common case)
 *  - `user`     → 28 px avatar + name + subtitle
 *  - `badge`    → 84 × 20 pill
 *  - `numeric`  → end-aligned 56 px line, `tabular-nums` semantics
 */
export function SkeletonTableRow({
  columns,
  height = 52,
  className = "",
  animation,
  testId,
}: SkeletonTableRowProps) {
  return (
    <tr
      className={className}
      aria-hidden="true"
      data-testid={testId}
    >
      {columns.map((col, i) => {
        const align =
          col.align === "end"
            ? "text-end"
            : col.align === "center"
            ? "text-center"
            : "text-start";
        return (
          <td
            key={i}
            style={{ width: col.width, height }}
            className={`px-4 align-middle ${align}`}
          >
            {col.type === "user" ? (
              <div className="flex items-center gap-2.5">
                <SkeletonCircle size={28} animation={animation} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <SkeletonLine width="60%" size="md" animation={animation} />
                  <SkeletonLine width="40%" size="sm" animation={animation} />
                </div>
              </div>
            ) : col.type === "badge" ? (
              <SkeletonRectangle
                width={84}
                height={20}
                rounded="pill"
                animation={animation}
              />
            ) : col.type === "numeric" ? (
              <div
                className={`flex ${
                  col.align === "end"
                    ? "justify-end"
                    : col.align === "center"
                    ? "justify-center"
                    : ""
                }`}
              >
                <SkeletonLine width={56} size="md" animation={animation} />
              </div>
            ) : (
              <SkeletonLine width="70%" size="md" animation={animation} />
            )}
          </td>
        );
      })}
    </tr>
  );
}
