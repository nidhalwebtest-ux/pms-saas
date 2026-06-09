"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { TabsContentProps } from "./types";

/* ============================================================================
 *  TabsContent
 *
 *  Thin wrapper around Radix's Content. By default Radix renders all panels
 *  to the DOM and toggles `hidden` on inactive ones — fine for most cases.
 *
 *  When the panel is expensive (triggers an API fetch, mounts a large
 *  subtree), keep the conditional render in the consumer so the panel
 *  unmounts when inactive:
 *
 *      {tab === "ledger" && (
 *        <TabsContent value="ledger">
 *          <TenantLedger … />
 *        </TabsContent>
 *      )}
 *
 *  Wire `forceMount` only when SEO requires inactive panels to render
 *  server-side.
 * ========================================================================= */

export function TabsContent({
  value,
  forceMount,
  className = "",
  children,
}: TabsContentProps) {
  return (
    <RadixTabs.Content
      value={value}
      forceMount={forceMount ? true : undefined}
      className={[
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 motion-safe:ease-out",
        "focus-visible:outline-none focus-visible:shadow-focus rounded-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </RadixTabs.Content>
  );
}
