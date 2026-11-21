/**
 * Home-page sections of the public booking sites (client + server safe).
 * The operator chooses which sections show and in what order (Settings → Website →
 * Sections & content); the hero is always first. A section without content simply
 * renders nothing, so enabling it early is harmless.
 */

export const SECTION_KEYS = ["highlights", "khareef", "featured", "gallery", "about", "reviews", "policies", "location"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type SectionConfig = { key: SectionKey; enabled: boolean };

/** Default order. Gallery is opt-in so existing sites don't change until the operator enables it. */
export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: "highlights", enabled: true },
  { key: "khareef", enabled: false },
  { key: "featured", enabled: true },
  { key: "gallery", enabled: false },
  { key: "about", enabled: true },
  { key: "reviews", enabled: true },
  { key: "policies", enabled: true },
  { key: "location", enabled: true },
];

const isKey = (k: unknown): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k as string);

/**
 * Sanitise the stored JSON into a complete, ordered list: unknown keys dropped, duplicates
 * ignored, missing sections appended with their defaults. The Khareef banner's visibility
 * is its own long-standing setting (OrgWebsite.khareefBannerEnabled), so it always wins here.
 */
export function parseSections(raw: unknown, khareefEnabled: boolean): SectionConfig[] {
  const out: SectionConfig[] = [];
  const seen = new Set<SectionKey>();
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const key = (r as SectionConfig)?.key;
      if (!isKey(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, enabled: (r as SectionConfig).enabled !== false });
    }
  }
  for (const d of DEFAULT_SECTIONS) if (!seen.has(d.key)) out.push({ ...d });
  return out.map((s) => (s.key === "khareef" ? { key: s.key, enabled: khareefEnabled } : s));
}

// ── Guest reviews (entered by the operator) ──────────────────────────────────

export type Review = { name: string; textEn: string; textAr: string; rating: number };
export const MAX_REVIEWS = 8;
export const MAX_GALLERY = 12;

export function parseReviews(raw: unknown): Review[] {
  if (!Array.isArray(raw)) return [];
  const out: Review[] = [];
  for (const r of raw) {
    const name = String((r as Review)?.name ?? "").trim().slice(0, 80);
    const textEn = String((r as Review)?.textEn ?? "").trim().slice(0, 600);
    const textAr = String((r as Review)?.textAr ?? "").trim().slice(0, 600);
    const n = Math.round(Number((r as Review)?.rating));
    if (!name || (!textEn && !textAr)) continue;
    out.push({ name, textEn, textAr, rating: Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 5 });
    if (out.length >= MAX_REVIEWS) break;
  }
  return out;
}

/** "HH:MM" (24h) or null. */
export function parseTime(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

/** Only https image URLs, de-duplicated, capped. */
export function parseGallery(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const u of raw) {
    const s = String(u ?? "").trim();
    if (/^https:\/\//i.test(s) && !out.includes(s)) out.push(s);
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}
