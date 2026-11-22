/**
 * SEO helpers for the public booking sites: canonical origin, language alternates (hreflang),
 * and per-page metadata. Pure — no I/O. Used by every page's generateMetadata and the sitemap.
 *
 * URL scheme (see lib/public-site/lang.ts): the site's default language lives at `/…`, the other
 * at `/{lang}/…`. The canonical host is the operator's custom domain once it's verified,
 * otherwise `{slug}.binaya.app`.
 */
import type { Metadata } from "next";
import type { SiteView } from "./render";
import type { SiteLang } from "./i18n";
import { siteDefaultLang } from "./lang";

export const ROOT_DOMAIN = "binaya.app";

/** The canonical origin of a site (no trailing slash). */
export function siteOrigin(site: { slug: string; customDomain?: string | null; customDomainActive?: boolean }): string {
  return site.customDomain && site.customDomainActive ? `https://${site.customDomain}` : `https://${site.slug}.${ROOT_DOMAIN}`;
}

/** Absolute URL of `path` in `lang` ("/" → the home page). */
export function langUrl(origin: string, lang: SiteLang, defaultLanguage: string | null | undefined, path: string): string {
  const p = path === "/" ? "" : path;
  return lang === siteDefaultLang(defaultLanguage) ? `${origin}${p || "/"}` : `${origin}/${lang}${p}`;
}

/** The two language versions of a page + x-default (the site's default language). */
export function languageAlternates(origin: string, defaultLanguage: string | null | undefined, path: string) {
  const def = siteDefaultLang(defaultLanguage);
  return {
    ar: langUrl(origin, "ar", defaultLanguage, path),
    en: langUrl(origin, "en", defaultLanguage, path),
    "x-default": langUrl(origin, def, defaultLanguage, path),
  };
}

/** First absolute http(s) image from a list. */
export const firstImage = (...urls: (string | null | undefined)[]): string | undefined =>
  urls.find((u) => !!u && /^https?:\/\//i.test(u)) ?? undefined;

/**
 * Full page metadata: title/description, canonical + hreflang alternates, Open Graph and
 * Twitter card. Owner previews get no alternates (they're noindex'd by the layout).
 * `path` is the language-less site path ("/", "/buildings/{id}"…).
 */
export function pageMetadata(
  v: SiteView,
  opts: { title?: string; description?: string | null; path: string; image?: string | null; type?: "website" | "article"; noindex?: boolean },
): Metadata {
  const { site, lang, siteName, preview } = v;
  const origin = siteOrigin(site);
  const url = langUrl(origin, lang, site.defaultLanguage, opts.path);
  const description = opts.description?.trim().slice(0, 300) || undefined;
  const image = firstImage(opts.image, site.ogImageUrl, site.logoUrl);
  const fullTitle = opts.title ? `${opts.title} · ${siteName}` : siteName;

  return {
    title: opts.title,
    description,
    alternates: preview ? undefined : { canonical: url, languages: languageAlternates(origin, site.defaultLanguage, opts.path) },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      type: opts.type ?? "website",
      locale: lang === "ar" ? "ar_OM" : "en_OM",
      alternateLocale: lang === "ar" ? ["en_OM"] : ["ar_OM"],
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: fullTitle, description, images: image ? [image] : undefined },
    robots: opts.noindex || preview ? { index: false, follow: !preview } : undefined,
  };
}
