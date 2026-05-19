"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { useLayoutEffect, useRef, useState } from "react";
import type {
  TabsCountVariant,
  TabsSize,
  TabsTriggerProps,
  TabsVariant,
} from "./types";

/* ============================================================================
 *  Per-variant trigger classes
 *
 *  All triggers share `relative z-[1]` so the sliding indicator (z: 0) sits
 *  behind the text. The underline variant doesn't paint its own bottom
 *  border — the indicator handles it.
 * ========================================================================= */

const triggerBase =
  "relative z-[1] inline-flex items-center gap-2 whitespace-nowrap " +
  "text-fg-secondary font-medium transition-colors duration-fast " +
  "focus-visible:outline-none focus-visible:shadow-focus focus-visible:rounded-md " +
  "disabled:text-fg-disabled disabled:cursor-not-allowed " +
  "data-[disabled]:text-fg-disabled data-[disabled]:cursor-not-allowed";

const variantTriggerClass: Record<TabsVariant, string> = {
  underline:
    "border-0 hover:text-fg " +
    "data-[state=active]:text-brand-700",
  pill:
    "rounded-md hover:text-fg " +
    "data-[state=active]:text-fg",
  boxed:
    "border border-border-default border-b-0 rounded-t-lg bg-subtle " +
    "-mb-px hover:bg-muted hover:text-fg " +
    "data-[state=active]:bg-surface data-[state=active]:text-brand-700 data-[state=active]:border-border-strong " +
    "before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:rounded-t-sm before:opacity-0 " +
    "data-[state=active]:before:bg-brand-500 data-[state=active]:before:opacity-100",
};

const sizeTriggerClass: Record<TabsSize, string> = {
  sm: "h-9 px-2.5 text-[12.5px]",
  md: "h-11 px-3.5 text-[13px]",
  lg: "h-[52px] px-[18px] text-[14.5px]",
};

const sizeBadgeClass: Record<TabsSize, string> = {
  sm: "text-[10.5px] px-1.5 py-0.5",
  md: "text-[11px] px-1.5 py-1",
  lg: "text-[11.5px] px-1.5 py-0.5",
};

const sizeIconClass: Record<TabsSize, string> = {
  sm: "[&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "[&_svg]:h-4 [&_svg]:w-4",
  lg: "[&_svg]:h-[18px] [&_svg]:w-[18px]",
};

const sizeNotificationDot: Record<TabsSize, string> = {
  sm: "size-1.5 top-1.5 inset-ie-1",
  md: "size-1.5 top-2 inset-ie-1.5",
  lg: "size-2 top-2.5 inset-ie-2",
};

/* ============================================================================
 *  Count badge — tonal variants follow the spec. Active-state tinting flips
 *  the neutral palette to brand-tinted via the parent trigger's `data-state`.
 * ========================================================================= */

const countBaseClass =
  "font-mono leading-none rounded-full bg-subtle text-fg-secondary " +
  "tabular-nums ltr-numbers";

const countVariantClass: Record<TabsCountVariant, string> = {
  neutral:     "group-data-[state=active]:bg-brand-50 group-data-[state=active]:text-brand-700",
  destructive: "!bg-error-50 !text-error-700",
  warning:     "!bg-warning-50 !text-warning-700",
  success:     "!bg-success-50 !text-success-700",
};

function CountBadge({
  count,
  variant,
  ceiling,
  size,
}: {
  count: number;
  variant: TabsCountVariant;
  ceiling?: number;
  size: TabsSize;
}) {
  const display = ceiling !== undefined && count > ceiling
    ? `${ceiling}+`
    : count.toLocaleString();
  return (
    <span
      className={[
        countBaseClass,
        sizeBadgeClass[size],
        countVariantClass[variant],
      ].join(" ")}
    >
      {display}
    </span>
  );
}

/* ============================================================================
 *  TabsTrigger
 *
 *  Reads `data-variant` / `data-size` off the nearest `[role="tablist"]` so
 *  consumers don't have to pass size + variant on every trigger. Falls back
 *  to underline / md if the list hasn't mounted yet (first paint).
 * ========================================================================= */

export function TabsTrigger({
  value,
  icon,
  count,
  countVariant = "neutral",
  countCeiling,
  notification,
  disabled,
  tooltip,
  className = "",
  children,
}: TabsTriggerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [{ variant, size }, setCfg] = useState<{ variant: TabsVariant; size: TabsSize }>({
    variant: "underline",
    size:    "md",
  });

  useLayoutEffect(() => {
    const list = triggerRef.current?.closest('[role="tablist"]');
    if (!list) return;
    setCfg({
      variant: (list.getAttribute("data-variant") as TabsVariant) ?? "underline",
      size:    (list.getAttribute("data-size")    as TabsSize)    ?? "md",
    });
  }, []);

  const cls = [
    "group",
    triggerBase,
    variantTriggerClass[variant],
    sizeTriggerClass[size],
    sizeIconClass[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Build the accessible name suffix so screen readers get the count.
  const countSuffix = count !== undefined
    ? `, ${count} ${count === 1 ? "record" : "records"}`
    : "";
  const notificationSuffix = notification ? ", unread" : "";
  const ariaLabel = typeof children === "string"
    ? `${children}${countSuffix}${notificationSuffix}`
    : undefined;

  return (
    <RadixTabs.Trigger
      ref={triggerRef}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      title={tooltip}
      className={cls}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined && (
        <CountBadge
          count={count}
          variant={countVariant}
          ceiling={countCeiling}
          size={size}
        />
      )}
      {notification && (
        <span
          aria-hidden="true"
          className={`absolute rounded-full bg-error-500 ${sizeNotificationDot[size]}`}
        />
      )}
    </RadixTabs.Trigger>
  );
}
