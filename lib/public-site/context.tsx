"use client";

import { createContext, useContext } from "react";
import type { PublicDict, SiteLang } from "./i18n";

/** Everything a public client component needs — fed once by the server layout. */
export interface SiteContext {
  slug: string;
  lang: SiteLang;
  dir: "rtl" | "ltr";
  dict: PublicDict;
  rootDomain: string;
  templateKey: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  showPrices: boolean;
  siteName: string;
  whatsapp: string | null;
}

const Ctx = createContext<SiteContext | null>(null);

export function SiteProvider({ value, children }: { value: SiteContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSite must be used within <SiteProvider>");
  return c;
}
