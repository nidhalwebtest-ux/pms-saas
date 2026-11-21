/**
 * Public-site language in the URL (client-safe, no server imports).
 *
 * Visitors see:   /…        → the site's default language
 *                 /en/…     → English
 *                 /ar/…     → Arabic
 * The middleware rewrites these to the internal segment /sites/{slug}/{lang}/…
 * where lang ∈ LANG_PARAMS ("default" = unprefixed URL). Keeping the language in
 * the path (not a cookie) lets every page be pre-rendered and served from the CDN.
 */
import type { SiteLang } from "./i18n";

export type LangParam = "ar" | "en" | "default";
export const LANG_PARAMS: readonly LangParam[] = ["ar", "en", "default"];

export const isLangParam = (v: string): v is LangParam => (LANG_PARAMS as readonly string[]).includes(v);

/** Site default language (anything but "en" means Arabic). */
export const siteDefaultLang = (defaultLanguage: string | null | undefined): SiteLang =>
  defaultLanguage === "en" ? "en" : "ar";

/** The language a page renders in. */
export function langFromParam(param: string, defaultLanguage: string | null | undefined): SiteLang {
  return param === "ar" || param === "en" ? param : siteDefaultLang(defaultLanguage);
}

/** URL prefix that keeps the visitor in the language they're browsing ("" for unprefixed URLs). */
export const basePathFor = (param: string): "" | "/ar" | "/en" =>
  param === "ar" ? "/ar" : param === "en" ? "/en" : "";

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

/** Where the language switch should go: default language → unprefixed URL. */
export function switchLangHref(pathname: string, target: SiteLang, defaultLanguage: string | null | undefined): string {
  const rest = stripLangPrefix(pathname);
  return target === siteDefaultLang(defaultLanguage) ? rest : withBase(`/${target}`, rest);
}
