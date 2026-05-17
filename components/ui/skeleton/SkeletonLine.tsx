"use client";

import { Skeleton } from "./Skeleton";
import type { SkeletonLineProps, SkeletonLineSize } from "./types";

const lineHeight: Record<SkeletonLineSize, number> = {
  sm: 10,
  md: 12,
  lg: 16,
};

/**
 * Single text-line placeholder. Use for headings, captions, individual
 * paragraph lines, or anywhere a `<span>` of text would normally sit.
 */
export function SkeletonLine({
  width = "100%",
  size = "md",
  className,
  animation,
  testId,
}: SkeletonLineProps) {
  return (
    <Skeleton
      shape="line"
      width={width}
      height={lineHeight[size]}
      rounded="sm"
      className={className}
      animation={animation}
      testId={testId}
    />
  );
}
