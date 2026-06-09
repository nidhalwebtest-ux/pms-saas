"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { TabsProps } from "./types";

/* ============================================================================
 *  Tabs root — thin wrapper around Radix's Tabs.Root so consumers get our
 *  typed props + a stable forwarding contract for the list / triggers /
 *  content beneath.
 * ========================================================================= */

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  orientation = "horizontal",
  activationMode = "manual",
  dir,
  className = "",
  children,
}: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      orientation={orientation}
      activationMode={activationMode}
      dir={dir}
      className={
        orientation === "vertical"
          ? `flex gap-6 ${className}`
          : className
      }
    >
      {children}
    </RadixTabs.Root>
  );
}
