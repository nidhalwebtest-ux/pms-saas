/**
 * Blog — shared constants (safe for client + server).
 *
 * Public URLs:  /blog/{lang}            index (only articles that exist in {lang})
 *               /blog/{lang}/{slug}     article
 *               /blog/{lang}/rss.xml    feed
 * The language lives in the path (not the NEXT_LOCALE cookie) so Google can
 * crawl and index each language version separately, linked by hreflang.
 * middleware.ts forwards it to next-intl via the x-binaya-locale header.
 */

export const BLOG_LANGS = ["en", "ar"] as const;
export type BlogLang = (typeof BLOG_LANGS)[number];

export function isBlogLang(v: unknown): v is BlogLang {
  return v === "en" || v === "ar";
}

/** Canonical origin of the marketing site (absolute URLs in metadata, sitemap, RSS, JSON-LD). */
export const SITE_URL = (process.env.APP_ORIGIN || "https://www.binaya.app").replace(/\/+$/, "");

/** Cache tag for every public blog query; updateTag() it after admin edits. */
export const BLOG_TAG = "blog-posts";

export const BLOG_PAGE_SIZE = 9;

/** Fixed category list (translated here, so no admin UI is needed to manage it). */
export const BLOG_CATEGORIES = [
  { key: "guides", en: "Guides", ar: "أدلة عملية" },
  { key: "hospitality", en: "Hospitality tips", ar: "نصائح الضيافة" },
  { key: "khareef", en: "Khareef season", ar: "موسم الخريف" },
  { key: "product", en: "Product updates", ar: "تحديثات المنتج" },
  { key: "case-studies", en: "Case studies", ar: "قصص نجاح" },
  { key: "news", en: "News", ar: "أخبار" },
] as const;

export type BlogCategoryKey = (typeof BLOG_CATEGORIES)[number]["key"];

export function isBlogCategory(v: unknown): v is BlogCategoryKey {
  return BLOG_CATEGORIES.some((c) => c.key === v);
}

export function categoryLabel(key: string, lang: BlogLang): string {
  const c = BLOG_CATEGORIES.find((x) => x.key === key);
  return c ? c[lang] : key;
}

export function blogIndexPath(lang: BlogLang) {
  return `/blog/${lang}`;
}

export function blogPostPath(lang: BlogLang, slug: string) {
  return `/blog/${lang}/${encodeURIComponent(slug)}`;
}

/** Article date, e.g. "12 March 2026" / "١٢ مارس ٢٠٢٦". */
export function formatBlogDate(iso: string, lang: BlogLang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Muscat",
  }).format(new Date(iso));
}
