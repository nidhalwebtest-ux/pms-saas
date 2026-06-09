import type { ReactNode } from "react";

/** Shared props on every primitive. */
export interface SkeletonBaseProps {
  /** Forwarded to the root element. */
  className?: string;
  /** Override the default pulse animation. */
  animation?: "pulse" | "none";
  /** Test ID for QA. */
  testId?: string;
}

/* ============================================================================
 *  Skeleton — atomic primitive
 * ========================================================================= */

export type SkeletonShape = "line" | "circle" | "rect";
export type SkeletonRounded = "none" | "sm" | "md" | "lg" | "pill";

export interface SkeletonProps extends SkeletonBaseProps {
  /** Visual shape. Default `"rect"`. */
  shape?: SkeletonShape;
  /** CSS width — number = px, string = any CSS value. Default `"100%"`. */
  width?: number | string;
  /** CSS height — number = px, string = any CSS value. */
  height?: number | string;
  /** Border radius token. Default `"sm"`. Ignored when `shape="circle"`. */
  rounded?: SkeletonRounded;
}

/* ============================================================================
 *  SkeletonLine
 * ========================================================================= */

export type SkeletonLineSize = "sm" | "md" | "lg";

export interface SkeletonLineProps extends SkeletonBaseProps {
  /** Default `"100%"`. */
  width?: number | string;
  /** Maps to the line height tokens. Default `"md"`. */
  size?: SkeletonLineSize;
}

/* ============================================================================
 *  SkeletonText
 * ========================================================================= */

export interface SkeletonTextProps extends SkeletonBaseProps {
  /** How many lines to render. Default `3`. */
  lines?: number;
  /** Size of each line. Default `"md"`. */
  size?: SkeletonLineSize;
  /** Make the last line shorter to mimic natural paragraphs. Default `true`. */
  lastLineShorter?: boolean;
  /** Width of the last line when shortened. Default `"60%"`. */
  lastLineWidth?: string;
  /** Gap between lines in px. Default `8`. */
  gap?: number;
}

/* ============================================================================
 *  SkeletonCircle
 * ========================================================================= */

export type SkeletonCircleSize = "sm" | "md" | "lg" | "xl" | number;

export interface SkeletonCircleProps extends SkeletonBaseProps {
  /** Pixel size — token or number. Default `"md"` (48 px). */
  size?: SkeletonCircleSize;
}

/* ============================================================================
 *  SkeletonRectangle
 * ========================================================================= */

export interface SkeletonRectangleProps extends SkeletonBaseProps {
  width?: number | string;
  height?: number | string;
  rounded?: SkeletonRounded;
}

/* ============================================================================
 *  SkeletonCard
 * ========================================================================= */

export interface SkeletonCardProps extends SkeletonBaseProps {
  /** Inner padding in px or any CSS value. Default `24`. */
  padding?: number | string;
  /** Visible 1px border like the real cards. Default `true`. */
  bordered?: boolean;
  /**
   * Announce as a loading region (sets role / aria-busy / aria-live / aria-label
   * on the container). Default `true`. Disable on nested cards so a parent
   * presets the only loading announcement.
   */
  announce?: boolean;
  children: ReactNode;
}

/* ============================================================================
 *  SkeletonTableRow
 * ========================================================================= */

export type SkeletonTableCellType = "default" | "user" | "badge" | "numeric";
export type SkeletonTableAlign = "start" | "end" | "center";

export interface SkeletonTableColumn {
  width: number | string;
  /** Cell renderer hint. Default `"default"`. */
  type?: SkeletonTableCellType;
  align?: SkeletonTableAlign;
}

export interface SkeletonTableRowProps extends SkeletonBaseProps {
  /** Widths + types for each cell. Drives column count. */
  columns: SkeletonTableColumn[];
  /** Row height in px to match the real row. Default `52`. */
  height?: number;
}
