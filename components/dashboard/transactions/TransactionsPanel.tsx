"use client";

/* ============================================================================
 *  TransactionsPanel — the tabbed transaction surface used on entity detail
 *  pages (Unit, Tenant). Tabs: Overview (3 compact cards) | Reservations |
 *  Invoices | Payments. "View all" on a card jumps to that section's tab.
 *
 *  Tab state is URL-synced via ?txn= so a shared link reopens the same view.
 * ========================================================================= */

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { useTabParam } from "@/hooks/useTabParam";
import {
  TransactionsOverview,
  ReservationsList,
  InvoicesList,
  PaymentsList,
  type TransactionData,
  type TxnSection,
} from "./TransactionSections";

export default function TransactionsPanel({ data }: { data: TransactionData }) {
  const t = useTranslations("transactions");
  const [tab, setTab] = useTabParam("txn", "overview");
  const value = tab || "overview";

  return (
    <Tabs value={value} onValueChange={setTab}>
      <TabsList variant="underline" size="md" ariaLabel={t("ariaLabel")}>
        <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
        <TabsTrigger value="reservations">{t("reservations")}</TabsTrigger>
        <TabsTrigger value="invoices">{t("invoices")}</TabsTrigger>
        <TabsTrigger value="payments">{t("payments")}</TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <TabsContent value="overview">
          <TransactionsOverview data={data} onViewAll={(s: TxnSection) => setTab(s)} />
        </TabsContent>
        <TabsContent value="reservations">
          <ReservationsList data={data} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesList data={data} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsList data={data} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
