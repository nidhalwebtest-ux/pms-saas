import "server-only";
import { cache } from "react";
import { getSiteBySlug, type PublicSite } from "./data";
import { getDict, type PublicDict, type SiteLang } from "./i18n";
import { basePathFor, langFromParam, otherBasePathFor, parsePreviewParam } from "./lang";
import { verifyPreviewToken } from "./preview-token";
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
  /** "" | "/ar" | "/en" (or the preview prefix) — prefix for every internal link */
  base: string;
  /** prefix of the other language's URLs (language switch) */
  otherBase: string;
  /** owner preview of an unpublished/draft site */
  preview: boolean;
  siteName: string;
};

export const getSiteView = cache(async (slug: string, langParam: string): Promise<SiteView | null> => {
  const pv = parsePreviewParam(langParam);
  let site: PublicSite | null;
  if (pv) {
    // Owner preview: needs a valid signed token (checked when the page is built). Reads fresh,
    // drafts included. Each "Preview" click mints a new token = a new URL, so it always renders
    // fresh; the same URL may be served from cache for up to the route's revalidate window.
    // (Do NOT call connection() here — it errors inside pre-rendered/ISR routes.)
    if (!verifyPreviewToken(pv.token, slug)) return null;
    site = await getSiteBySlug(slug, { allowUnpublished: true });
  } else {
    site = await getCachedSite(slug);
  }
  if (!site) return null;
  const lang = langFromParam(langParam, site.defaultLanguage);
  return {
    site,
    slug,
    lang,
    dir: dirFor(lang),
    dict: getDict(lang),
    theme: themeFor(site.templateKey, site.fontPreset),
    base: basePathFor(langParam, slug),
    otherBase: otherBasePathFor(langParam, slug, lang, site.defaultLanguage),
    preview: !!pv,
    siteName: (lang === "ar" ? site.siteNameAr : site.siteNameEn) || site.siteNameEn || site.siteNameAr || site.orgName,
  };
});
