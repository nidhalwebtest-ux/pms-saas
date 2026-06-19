"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { useLayoutEffect, useRef, useState } from "react";
import type { TabsListProps, TabsSize, TabsVariant } from "./types";

/* ============================================================================
 *  Visual treatment tables
 * ========================================================================= */

const listClass: Record<TabsVariant, string> = {
  underline:
    "relative flex items-stretch border-b border-border-subtle " +
    "overflow-x-auto scrollbar-none",
  pill:
    "relative inline-flex bg-subtle border border-border-subtle rounded-[10px] p-[3px] gap-[2px]",
  boxed:
    "relative flex items-end gap-1 border-b border-border-default",
};

const verticalListClass: Record<TabsVariant, string> = {
  underline:
    "relative flex flex-col gap-[2px] border-ie border-border-subtle py-2 min-w-[200px]",
  pill:
    "relative inline-flex flex-col bg-subtle border border-border-subtle rounded-[10px] p-[3px] gap-[2px]",
  boxed:
    "relative flex flex-col gap-1 border-ie border-border-default",
};

const sizeContainerPad: Record<TabsSize, string> = {
  sm: "",
  md: "",
  lg: "",
};

/* ============================================================================
 *  TabsList — renders the Radix List plus a single sliding indicator that
 *  measures the active trigger and translates between selections.
 *
 *  Indicator strategy:
 *  - underline (horizontal): 2 px brand bar pinned to the strip's bottom edge
 *  - underline (vertical):   2 px brand bar pinned to the inline-start edge
 *  - pill:                   full-size white pill behind the active trigger
 *  - boxed:                  no indicator — triggers carry their own active look
 * ========================================================================= */

export function TabsList({
  variant = "underline",
  size = "md",
  fullWidth = false,
  scrollOverflow = true,
  ariaLabel,
  className = "",
  children,
}: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [hasMeasured, setHasMeasured] = useState(false);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    setOrientation((list.getAttribute("aria-orientation") as "horizontal" | "vertical") ?? "horizontal");

    function measure() {
      if (!list) return;
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return;
      // offsetLeft / offsetTop are relative to the offsetParent, which is the
      // list itself (it has `relative`). offsetLeft tracks visual position
      // correctly in both LTR and RTL.
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      });
      setHasMeasured(true);
    }

    measure();
    const mo = new MutationObserver(measure);
    mo.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "aria-orientation"],
    });
    const ro = new ResizeObserver(measure);
    ro.observe(list);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  const isVertical = orientation === "vertical";

  const root = [
    isVertical ? verticalListClass[variant] : listClass[variant],
    sizeContainerPad[size],
    fullWidth && variant === "pill" ? "w-full" : "",
    !isVertical && scrollOverflow ? "overflow-x-auto" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Underline indicator is a fixed 2 px bar — let CSS own that dimension and
  // only animate the cross-axis. Pill indicator matches the trigger on both
  // axes.
  const indicatorStyle: React.CSSProperties = (() => {
    if (variant === "underline") {
      return isVertical
        ? { transform: `translateY(${box.y}px)`, height: box.h }
        : { transform: `translateX(${box.x}px)`, width: box.w };
    }
    return {
      transform: `translate(${box.x}px, ${box.y}px)`,
      width: box.w,
      height: box.h,
    };
  })();

  return (
    <RadixTabs.List
      ref={listRef}
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size}
      className={root}
    >
      {children}

      {variant !== "boxed" && hasMeasured && (
        <span
          aria-hidden="true"
          data-indicator={variant}
          style={indicatorStyle}
          className={indicatorClassName(variant, isVertical)}
        />
      )}
    </RadixTabs.List>
  );
}

function indicatorClassName(variant: TabsVariant, vertical: boolean): string {
  const base = "absolute pointer-events-none motion-safe:transition-[transform,width,height] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(.4,0,.2,1)]";
  if (variant === "underline") {
    return vertical
      ? `${base} top-0 start-0 w-0.5 rounded-e-sm bg-brand-500`
      // For horizontal: keep the bar at the strip's bottom edge. We set
      // height to 2 px and let the X translate / width sync with the active
      // trigger via inline style.
      : `${base} bottom-0 start-0 h-0.5 rounded-t-sm bg-brand-500`;
  }
  // pill — full-size pill behind the active trigger
  return `${base} top-0 start-0 bg-surface shadow-sm rounded-md z-0`;
}
