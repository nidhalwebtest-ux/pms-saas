/**
 * Blog text helpers — pure string functions, no DOM, so the SEO analysis runs
 * identically in the editor (browser) and in the save action (server).
 */

/** Arabic-aware normalization for keyword matching: lower-case, no diacritics/tatweel,
 *  unified alef / yaa / taa-marbuta forms, collapsed whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL slug. Keeps Latin letters/digits AND Arabic letters (Google handles
 * Arabic slugs well, and they match Arabic search queries), everything else → "-".
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9ء-ي٠-٩۰-۹]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9ء-ي٠-٩۰-۹]+(?:-[a-z0-9ء-ي٠-٩۰-۹]+)*$/;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e] ?? _);
}

/** Visible text of an HTML fragment. Block boundaries become spaces so words don't merge. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|h[1-6]|li|blockquote|td|th|div|figcaption|pre)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Reading time; Arabic is read a little slower than English. */
export function readingMinutes(words: number, lang: "en" | "ar"): number {
  return Math.max(1, Math.round(words / (lang === "ar" ? 180 : 220)));
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? "") : null;
}

export interface HtmlAnalysis {
  text: string;
  words: number;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  images: { src: string; alt: string }[];
  links: { href: string; internal: boolean }[];
  videos: number;
}

/** Structure of the article body used by the SEO score. */
export function analyzeHtml(html: string, siteHost = "binaya.app"): HtmlAnalysis {
  const text = htmlToText(html);
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: htmlToText(m[2]),
  }));
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => htmlToText(m[1]))
    .filter(Boolean);
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], "src") ?? "",
    alt: (attr(m[0], "alt") ?? "").trim(),
  }));
  const links = [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((m) => attr(m[0], "href") ?? "")
    .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:") && !h.startsWith("tel:"))
    .map((href) => {
      let internal = href.startsWith("/");
      if (!internal) {
        try {
          internal = new URL(href).hostname.replace(/^www\./, "").endsWith(siteHost);
        } catch {
          internal = false;
        }
      }
      return { href, internal };
    });
  const videos = (html.match(/<video\b/gi)?.length ?? 0) + (html.match(/<iframe\b/gi)?.length ?? 0);
  return { text, words: countWords(text), headings, paragraphs, images, links, videos };
}
