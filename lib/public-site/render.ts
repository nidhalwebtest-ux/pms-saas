import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSiteBySlug, type PublicSite } from "./data";
import type { SiteLang } from "./i18n";

/** Per-request memoised site lookup so layout + page share ONE query. */
export const getCachedSite = cache((slug: string) => getSiteBySlug(slug));

export const LANG_COOKIE = "site_lang";

/**
 * Visitor language: explicit ?lang override → their cookie → the site default.
 * Independent of the app's NEXT_LOCALE so it never leaks the operator's locale.
 */
export async function resolveLang(site: PublicSite, paramLang?: string): Promise<SiteLang> {
  if (paramLang === "ar" || paramLang === "en") return paramLang;
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c === "ar" || c === "en") return c;
  return site.defaultLanguage === "en" ? "en" : "ar";
}

export const dirFor = (lang: SiteLang): "rtl" | "ltr" => (lang === "ar" ? "rtl" : "ltr");
