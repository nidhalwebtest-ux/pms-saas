"use client";

import { createContext, useContext } from "react";
import { formatCurrency as fmt, formatAmount as amt } from "@/lib/format-currency";

type OrgContextValue = { currency: string };

const OrgContext = createContext<OrgContextValue>({ currency: "OMR" });

export function OrgProvider({
  value,
  children,
}: {
  value: OrgContextValue;
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgCurrency(): string {
  return useContext(OrgContext).currency;
}

/**
 * Hook returning a `formatCurrency` already bound to the org's currency.
 * Usage: const fmt = useFormatCurrency(); fmt(invoice.balance) → "320.500 OMR"
 */
export function useFormatCurrency(): (amount: Parameters<typeof fmt>[0]) => string {
  const currency = useOrgCurrency();
  return (amount) => fmt(amount, currency);
}

export function useFormatAmount(): (amount: Parameters<typeof amt>[0]) => string {
  const currency = useOrgCurrency();
  return (amount) => amt(amount, currency);
}
