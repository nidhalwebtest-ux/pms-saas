"use client";

import { Skeleton } from "./Skeleton";
import type { SkeletonRectangleProps } from "./types";

/**
 * Block placeholder — images, buttons, badge / pill stubs, hero panels, etc.
 * Pick a `rounded` token that matches the real shape (pill for badges,
 * md for cards / inputs, lg for hero images).
 */
export function SkeletonRectangle({
  width,
  height,
  rounded = "md",
  className,
  animation,
  testId,
}: SkeletonRectangleProps) {
  return (
    <Skeleton
      shape="rect"
      width={width}
      height={height}
      rounded={rounded}
      className={className}
      animation={animation}
      testId={testId}
    />
  );
}
