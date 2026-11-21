/**
 * Public-site language in the URL (client-safe, no server imports).
 *
 * Visitors see:   /…        → the site's default language
 *                 /en/…     → English
 *                 /ar/…     → Arabic
 * The middleware rewrites these to the internal segment /sites/{slug}/{lang}/…
 * where lang ∈ LANG_PARAMS ("default" = unprefixed URL). Keeping the language in
 * the path (not a cookie) lets every page be pre-rendered and served from the CDN.
 *
 * Owner preview (before publishing): /site-preview/{slug}/{token}/{ar|en}/… is rewritten
 * to the internal segment `p~{lang}~{token}` — see lib/public-site/preview-token.ts.
 */
import type { SiteLang } from "./i18n";

export type LangParam = "ar" | "en" | "default";
export const LANG_PARAMS: readonly LangParam[] = ["ar", "en", "default"];

const PREVIEW_RE = /^p~(ar|en)~([A-Za-z0-9._-]{10,400})$/;

/** The internal [lang] segment for an owner preview. */
export const previewParam = (lang: SiteLang, token: string) => `p~${lang}~${token}`;

export function parsePreviewParam(v: string): { lang: SiteLang; token: string } | null {
  const m = v.match(PREVIEW_RE);
  return m ? { lang: m[1] as SiteLang, token: m[2] } : null;
}

export const isLangParam = (v: string): v is LangParam =>
  (LANG_PARAMS as readonly string[]).includes(v) || PREVIEW_RE.test(v);

/** Site default language (anything but "en" means Arabic). */
export const siteDefaultLang = (defaultLanguage: string | null | undefined): SiteLang =>
  defaultLanguage === "en" ? "en" : "ar";

/** The language a page renders in. */
export function langFromParam(param: string, defaultLanguage: string | null | undefined): SiteLang {
  const p = parsePreviewParam(param);
  if (p) return p.lang;
  return param === "ar" || param === "en" ? param : siteDefaultLang(defaultLanguage);
}

/** URL prefix that keeps the visitor in the language they're browsing ("" for unprefixed URLs). */
export function basePathFor(param: string, slug?: string): string {
  const p = parsePreviewParam(param);
  if (p) return `/site-preview/${slug ?? ""}/${p.token}/${p.lang}`;
  return param === "ar" ? "/ar" : param === "en" ? "/en" : "";
}

/** Prefix of the OTHER language's URLs (for the language switch). */
export function otherBasePathFor(param: string, slug: string, current: SiteLang, defaultLanguage: string | null | undefined): string {
  const other: SiteLang = current === "ar" ? "en" : "ar";
  const p = parsePreviewParam(param);
  if (p) return `/site-preview/${slug}/${p.token}/${other}`;
  return other === siteDefaultLang(defaultLanguage) ? "" : `/${other}`;
}

/** Join the language prefix with a site path ("/" → "/en" or "/"). */
export function withBase(base: string, path: string): string {
  if (!base) return path || "/";
  return path === "/" || path === "" ? base : `${base}${path}`;
}

/** Strip a leading /ar or /en from a visible pathname. */
export function stripLangPrefix(pathname: string): string {
  const m = pathname.match(/^\/(ar|en)(?=\/|$)(.*)$/);
  return m ? m[2] || "/" : pathname || "/";
}
