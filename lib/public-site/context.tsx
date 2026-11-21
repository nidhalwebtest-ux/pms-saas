"use client";

import { createContext, useContext } from "react";
import type { PublicDict, SiteLang } from "./i18n";
import type { Theme } from "./theme";

/**
 * What the public site's CLIENT islands need (search bar, language switch,
 * booking form, live quote) — fed once by the server layout. Everything else on
 * the public site is a server component and gets a SiteView prop instead.
 */
export interface SiteContext {
  slug: string;
  lang: SiteLang;
  dir: "rtl" | "ltr";
  dict: PublicDict;
  /** "" | "/ar" | "/en" — prefix for internal links (see lib/public-site/lang.ts) */
  base: string;
  defaultLanguage: string;
  theme: Theme;
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
