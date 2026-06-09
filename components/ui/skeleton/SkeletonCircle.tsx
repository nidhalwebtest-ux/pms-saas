"use client";

import { Skeleton } from "./Skeleton";
import type { SkeletonCircleProps } from "./types";

const circleSize = { sm: 32, md: 48, lg: 64, xl: 96 };

/**
 * Round placeholder — typically an avatar / icon stub. Pass a number to use
 * any custom diameter, or one of the size tokens.
 */
export function SkeletonCircle({
  size = "md",
  className,
  animation,
  testId,
}: SkeletonCircleProps) {
  const px = typeof size === "number" ? size : circleSize[size];
  return (
    <Skeleton
      shape="circle"
      width={px}
      height={px}
      className={className}
      animation={animation}
      testId={testId}
    />
  );
}
