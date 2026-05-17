"use client";

import { SkeletonLine } from "./SkeletonLine";
import type { SkeletonTextProps } from "./types";

/**
 * Multi-line paragraph placeholder. The last line is shortened by default to
 * mimic natural text — pass `lastLineShorter={false}` for justified
 * placeholders (e.g. inside a card that wants a uniform block).
 */
export function SkeletonText({
  lines = 3,
  size = "md",
  lastLineShorter = true,
  lastLineWidth = "60%",
  gap = 8,
  className,
  animation,
  testId,
}: SkeletonTextProps) {
  return (
    <div
      className={`flex flex-col ${className ?? ""}`}
      style={{ gap }}
      role="presentation"
      data-testid={testId}
    >
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const width = isLast && lastLineShorter ? lastLineWidth : "100%";
        return (
          <SkeletonLine
            key={i}
            width={width}
            size={size}
            animation={animation}
          />
        );
      })}
    </div>
  );
}
