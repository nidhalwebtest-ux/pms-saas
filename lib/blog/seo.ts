/**
 * Blog SEO score (0–100) + publish gate, per language version.
 *
 * Pure and isomorphic: the editor runs it live on every keystroke and the save
 * action re-runs it server-side (authoritative — the stored seoScore and the
 * publish gate never trust the browser).
 *
 * Two kinds of checks:
 *  - REQUIRED: must pass before a language version can be published (they are the
 *    minimum Google needs to index and show the article properly).
 *  - SCORED: weighted recommendations (weights sum to 100) in the spirit of
 *    Yoast / Rank Math — keyword placement, lengths, structure, links, readability.
 */
import { analyzeHtml, normalizeText, slugify, SLUG_RE, type HtmlAnalysis } from "./text";

export interface SeoInput {
  lang: "en" | "ar";
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  contentHtml: string;
}

export type SeoStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  label: string;
  hint: string;
  status: SeoStatus;
  /** Points earned / available (0 for required-only checks). */
  points: number;
  weight: number;
  required: boolean;
}

export interface SeoReport {
  score: number;
  grade: "good" | "ok" | "poor";
  checks: SeoCheck[];
  /** Required checks that fail → this language version cannot be published. */
  blockers: SeoCheck[];
  analysis: HtmlAnalysis;
  /** What Google will most likely show. */
  effectiveTitle: string;
  effectiveDescription: string;
}

export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [120, 160] as const;
export const MIN_WORDS_REQUIRED = 300;
export const GOOD_WORDS = 800;

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export function gradeFor(score: number): SeoReport["grade"] {
  return score >= 80 ? "good" : score >= 50 ? "ok" : "poor";
}

export function analyzeSeo(input: SeoInput): SeoReport {
  const a = analyzeHtml(input.contentHtml);
  const kw = normalizeText(input.focusKeyword);
  const kwWords = kw ? kw.split(" ").length : 0;
  const effectiveTitle = (input.seoTitle || input.title).trim();
  const effectiveDescription = (input.seoDescription || input.excerpt).trim();
  const nTitle = normalizeText(effectiveTitle);
  const nDesc = normalizeText(effectiveDescription);
  const nText = normalizeText(a.text);
  const checks: SeoCheck[] = [];

  const add = (c: Omit<SeoCheck, "points"> & { points?: number }) =>
    checks.push({ ...c, points: c.points ?? (c.status === "pass" ? c.weight : 0) });

  // ── Required (publish gate) ────────────────────────────────────────────────
  const titleLen = input.title.trim().length;
  add({
    id: "title", required: true, weight: 0,
    label: "Article has a title",
    hint: "The H1 of the page. At least 10 characters.",
    status: titleLen >= 10 ? "pass" : "fail",
  });
  add({
    id: "slug", required: true, weight: 0,
    label: "URL slug is valid",
    hint: "Lower-case words separated by hyphens, e.g. khareef-pricing-guide.",
    status: input.slug && SLUG_RE.test(input.slug) && input.slug.length <= 90 ? "pass" : "fail",
  });
  add({
    id: "description", required: true, weight: 0,
    label: "Meta description is written",
    hint: "Google shows it under the title in results. At least 50 characters.",
    status: effectiveDescription.length >= 50 ? "pass" : "fail",
  });
  add({
    id: "cover", required: true, weight: 0,
    label: "Cover image with alt text",
    hint: "Used for Google Discover, social shares and the article header.",
    status: input.coverImageUrl && input.coverImageAlt.trim().length >= 5 ? "pass" : "fail",
  });
  add({
    id: "min-words", required: true, weight: 0,
    label: `At least ${MIN_WORDS_REQUIRED} words`,
    hint: `Thin pages rarely rank. Currently ${a.words} words.`,
    status: a.words >= MIN_WORDS_REQUIRED ? "pass" : "fail",
  });
  const missingAlt = a.images.filter((i) => i.alt.length < 3).length;
  add({
    id: "img-alt", required: true, weight: 0,
    label: "Every image has alt text",
    hint: missingAlt ? `${missingAlt} image(s) without a description.` : "Alt text helps Google Images and screen readers.",
    status: missingAlt === 0 ? "pass" : "fail",
  });

  // ── Scored (weights sum to 100) ────────────────────────────────────────────
  const tl = effectiveTitle.length;
  add({
    id: "title-length", required: false, weight: 10,
    label: `SEO title is ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} characters`,
    hint: `Currently ${tl}. Longer titles are cut off in Google.`,
    status: tl >= TITLE_RANGE[0] && tl <= TITLE_RANGE[1] ? "pass" : tl >= 20 && tl <= 70 ? "warn" : "fail",
    points: tl >= TITLE_RANGE[0] && tl <= TITLE_RANGE[1] ? 10 : tl >= 20 && tl <= 70 ? 5 : 0,
  });
  const dl = effectiveDescription.length;
  add({
    id: "description-length", required: false, weight: 5,
    label: `Meta description is ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]} characters`,
    hint: `Currently ${dl}.`,
    status: dl >= DESCRIPTION_RANGE[0] && dl <= DESCRIPTION_RANGE[1] ? "pass" : dl >= 80 && dl <= 180 ? "warn" : "fail",
    points: dl >= DESCRIPTION_RANGE[0] && dl <= DESCRIPTION_RANGE[1] ? 5 : dl >= 80 && dl <= 180 ? 3 : 0,
  });
  add({
    id: "keyword-set", required: false, weight: 5,
    label: "Focus keyword is set",
    hint: "The search phrase you want this article to rank for.",
    status: kw ? "pass" : "fail",
  });

  const kwCheck = (id: string, label: string, ok: boolean, weight: number, hint: string) =>
    add({ id, label, hint, weight, required: false, status: !kw ? "fail" : ok ? "pass" : "fail" });

  kwCheck("kw-title", "Keyword in the SEO title", !!kw && nTitle.includes(kw), 10, "Ideally near the beginning.");
  kwCheck("kw-description", "Keyword in the meta description", !!kw && nDesc.includes(kw), 5, "Google bolds matching words.");
  const slugKw = slugify(input.focusKeyword);
  kwCheck("kw-slug", "Keyword in the URL", !!slugKw && input.slug.includes(slugKw), 5, "Use the keyword in the slug.");
  const intro = normalizeText(a.paragraphs.slice(0, 2).join(" "));
  kwCheck("kw-intro", "Keyword in the introduction", !!kw && intro.includes(kw), 5, "Mention it in the first paragraph.");
  kwCheck(
    "kw-heading", "Keyword in a subheading", !!kw && a.headings.some((h) => h.level <= 3 && normalizeText(h.text).includes(kw)), 5,
    "Use it in at least one H2 or H3.",
  );
  const density = a.words && kw ? (occurrences(nText, kw) * kwWords * 100) / a.words : 0;
  add({
    id: "kw-density", required: false, weight: 5,
    label: "Keyword density 0.5%–3%",
    hint: kw ? `Currently ${density.toFixed(1)}%. Natural use, no stuffing.` : "Set a focus keyword first.",
    status: !kw ? "fail" : density >= 0.5 && density <= 3 ? "pass" : density > 0 ? "warn" : "fail",
    points: !kw ? 0 : density >= 0.5 && density <= 3 ? 5 : density > 0 ? 2 : 0,
  });

  add({
    id: "length", required: false, weight: 10,
    label: `Content is ${GOOD_WORDS}+ words`,
    hint: `Currently ${a.words}. In-depth articles rank better.`,
    status: a.words >= GOOD_WORDS ? "pass" : a.words >= MIN_WORDS_REQUIRED ? "warn" : "fail",
    points: a.words >= GOOD_WORDS ? 10 : a.words >= 500 ? 7 : a.words >= MIN_WORDS_REQUIRED ? 4 : 0,
  });
  const h2 = a.headings.filter((h) => h.level === 2).length;
  add({
    id: "subheadings", required: false, weight: 10,
    label: "Content is structured with H2 subheadings",
    hint: `${h2} H2 heading(s). Aim for one every ~300 words — they also build the table of contents.`,
    status: h2 >= Math.max(2, Math.floor(a.words / 400)) ? "pass" : h2 >= 1 ? "warn" : "fail",
    points: h2 >= Math.max(2, Math.floor(a.words / 400)) ? 10 : h2 >= 1 ? 5 : 0,
  });
  add({
    id: "media", required: false, weight: 5,
    label: "Body contains an image or video",
    hint: "Visuals keep readers on the page longer.",
    status: a.images.length + a.videos > 0 ? "pass" : "fail",
  });
  const internal = a.links.filter((l) => l.internal).length;
  const external = a.links.length - internal;
  add({
    id: "internal-links", required: false, weight: 5,
    label: "Links to another Binaya page",
    hint: `${internal} internal link(s). Link to related articles or the signup page.`,
    status: internal > 0 ? "pass" : "fail",
  });
  add({
    id: "external-links", required: false, weight: 5,
    label: "Links to a trusted external source",
    hint: `${external} external link(s). Cite sources to build trust.`,
    status: external > 0 ? "pass" : "warn",
  });
  const longParas = a.paragraphs.filter((p) => p.split(/\s+/).length > 150).length;
  add({
    id: "readability", required: false, weight: 5,
    label: "Short, readable paragraphs",
    hint: longParas ? `${longParas} paragraph(s) over 150 words — split them.` : "Paragraphs are a comfortable length.",
    status: longParas === 0 ? "pass" : "warn",
  });
  add({
    id: "excerpt", required: false, weight: 5,
    label: "Excerpt is written",
    hint: "Shown on blog cards and used when no meta description is set.",
    status: input.excerpt.trim().length >= 50 ? "pass" : "fail",
  });

  const score = Math.min(100, checks.reduce((s, c) => s + c.points, 0));
  return {
    score,
    grade: gradeFor(score),
    checks,
    blockers: checks.filter((c) => c.required && c.status !== "pass"),
    analysis: a,
    effectiveTitle,
    effectiveDescription,
  };
}
