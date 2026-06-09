"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { useTabParam } from "@/hooks/useTabParam";

/* ============================================================================
 *  Tenant detail tab strip. Reads + writes `?tab=` via useTabParam; the page
 *  itself is a server component and re-renders Overview vs Ledger based on
 *  the URL param. We intentionally do not wrap the page content in
 *  TabsContent — keeping the conditional render in the server page preserves
 *  SSR of Overview data and lazy-mount of the TenantLedger (which fetches
 *  its own data client-side).
 * ========================================================================= */

interface Props {
  currentTab: string;
  labels: { overview: string; ledger: string };
}

export default function TenantDetailTabs({ currentTab, labels }: Props) {
  const [tab, setTab] = useTabParam("tab", "overview");
  // Use the optimistic value from the hook when it changes, fall back to the
  // server-rendered value on first paint.
  const value = tab || currentTab;
  return (
    <Tabs value={value} onValueChange={setTab}>
      <TabsList variant="underline" size="md" ariaLabel="Tenant sections">
        <TabsTrigger value="overview">{labels.overview}</TabsTrigger>
        <TabsTrigger value="ledger">{labels.ledger}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
