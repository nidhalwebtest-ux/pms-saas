import "server-only";
import { cache } from "react";
import { getSiteBySlug, type PublicSite } from "./data";
import { getDict, type PublicDict, type SiteLang } from "./i18n";
import { basePathFor, langFromParam } from "./lang";
import { themeFor, type Theme } from "./theme";

/** Per-request memoised site lookup so layout + page share ONE query. */
export const getCachedSite = cache((slug: string) => getSiteBySlug(slug));

export const dirFor = (lang: SiteLang): "rtl" | "ltr" => (lang === "ar" ? "rtl" : "ltr");

/**
 * Everything a public page / server component needs to render, derived from the
 * site and the [lang] URL segment only — no cookies or headers, so pages stay
 * static and CDN-cacheable.
 */
export type SiteView = {
  site: PublicSite;
  slug: string;
  lang: SiteLang;
  dir: "rtl" | "ltr";
  dict: PublicDict;
  theme: Theme;
  /** "" | "/ar" | "/en" — prefix for every internal link */
  base: string;
  siteName: string;
};

export const getSiteView = cache(async (slug: string, langParam: string): Promise<SiteView | null> => {
  const site = await getCachedSite(slug);
  if (!site) return null;
  const lang = langFromParam(langParam, site.defaultLanguage);
  return {
    site,
    slug,
    lang,
    dir: dirFor(lang),
    dict: getDict(lang),
    theme: themeFor(site.templateKey),
    base: basePathFor(langParam),
    siteName: (lang === "ar" ? site.siteNameAr : site.siteNameEn) || site.siteNameEn || site.siteNameAr || site.orgName,
  };
});
