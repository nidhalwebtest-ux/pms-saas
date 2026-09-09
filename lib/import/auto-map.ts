import type { FieldSpec, FieldMapping } from "./types";

/* ============================================================================
 *  Auto-mapping — matches CSV headers to system fields by alias, case- and
 *  space-insensitive. Each FieldSpec carries English + Arabic alias variants
 *  (see lib/import/adapters/*.ts). Exact alias match only; no fuzzy/Levenshtein
 *  matching — a wrong silent match on financial/identity data is worse than
 *  asking the user to map one more field by hand.
 * ========================================================================= */

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/[أإآ]/g, "ا") // normalize alef variants so "الاسم"/"أسم" both match
    .trim();
}

export interface AutoMapResult {
  mapping: FieldMapping;
  /** Field keys that were auto-matched (render green / "matched"). */
  matchedFields: Set<string>;
  /** CSV headers that didn't match any field (shown to the user, ignored on import). */
  unmatchedColumns: string[];
}

export function autoMapHeaders(headers: string[], fields: FieldSpec[]): AutoMapResult {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const usedHeaders = new Set<string>();
  const mapping: FieldMapping = {};
  const matchedFields = new Set<string>();

  for (const field of fields) {
    const aliasSet = new Set([field.key, field.labelKey, ...field.aliases].map(normalizeHeader));
    const hit = normalizedHeaders.find((h) => !usedHeaders.has(h.raw) && aliasSet.has(h.norm));
    if (hit) {
      mapping[field.key] = hit.raw;
      usedHeaders.add(hit.raw);
      matchedFields.add(field.key);
    } else {
      mapping[field.key] = null;
    }
  }

  const unmatchedColumns = headers.filter((h) => !usedHeaders.has(h));

  return { mapping, matchedFields, unmatchedColumns };
}
