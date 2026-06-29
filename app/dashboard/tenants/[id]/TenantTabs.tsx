"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";

/* ============================================================================
 *  Client-side tenant detail tabs. Both panels are rendered/owned here and
 *  toggled in the browser, so switching Overview ↔ Ledger does NOT re-run the
 *  server page (which previously re-fetched ~14 queries + auth on every click).
 *  The Overview is server-rendered and passed in; the Ledger is lazy-mounted on
 *  first activation, then kept mounted so re-switching is instant. The URL
 *  `?tab=` is synced via history.replaceState (no navigation / round-trip).
 * ========================================================================= */

export default function TenantTabs({
  initialTab,
  labels,
  overview,
  ledger,
}: {
  initialTab: "overview" | "ledger";
  labels: { overview: string; ledger: string };
  overview: ReactNode;
  ledger: ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "ledger">(initialTab);
  const [ledgerMounted, setLedgerMounted] = useState(initialTab === "ledger");

  function change(next: string) {
    const v: "overview" | "ledger" = next === "ledger" ? "ledger" : "overview";
    setTab(v);
    if (v === "ledger") setLedgerMounted(true);
    try {
      const url = new URL(window.location.href);
      if (v === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", v);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* history unavailable — tab state still works */
    }
  }

  return (
    <>
      <div className="mb-6">
        <Tabs value={tab} onValueChange={change}>
          <TabsList variant="underline" size="md" ariaLabel="Tenant sections">
            <TabsTrigger value="overview">{labels.overview}</TabsTrigger>
            <TabsTrigger value="ledger">{labels.ledger}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className={tab === "overview" ? "" : "hidden"}>{overview}</div>
      {ledgerMounted && <div className={tab === "ledger" ? "" : "hidden"}>{ledger}</div>}
    </>
  );
}
