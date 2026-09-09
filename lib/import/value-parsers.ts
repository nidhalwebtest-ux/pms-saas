/* ============================================================================
 *  Shared cell-value parsers — dates and OMR amounts. Every adapter's
 *  parseRow() uses these so date-format ambiguity and decimal-precision bugs
 *  are fixed once, not per entity.
 * ========================================================================= */

export type DateFormatHint = "auto" | "DMY" | "MDY";

export interface ParsedValue<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/**
 * Parse an OMR amount. Accepts "120", "120.5", "120.500" — rejects anything
 * non-numeric, negative, or with more than 3 decimal places (silent rounding
 * would corrupt the 3-decimal-baisa precision the app relies on everywhere).
 */
export function parseOmrAmount(raw: string): ParsedValue<number> {
  const trimmed = raw.trim().replace(/,/g, ""); // tolerate thousands separators
  if (trimmed === "") return { ok: false, error: "empty" };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, error: "not_numeric" };
  const decimalPart = trimmed.split(".")[1];
  if (decimalPart && decimalPart.length > 3) return { ok: false, error: "too_many_decimals" };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "not_numeric" };
  // Round-trip through 3-decimal fixed precision to kill float noise (e.g. 0.1+0.2).
  return { ok: true, value: Number(value.toFixed(3)) };
}

/**
 * Parse a date string under an explicit or auto-detected day/month order.
 * "auto" tries ISO (YYYY-MM-DD) first, then falls back to DMY (the OMR/Gulf
 * regional default) — but ALWAYS prefers the explicit hint when given, since
 * guessing wrong silently corrupts data (e.g. 03/04 → Apr 3 vs Mar 4).
 */
export function parseImportDate(raw: string, hint: DateFormatHint): ParsedValue<Date> {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  // ISO form YYYY-MM-DD (or with time) — unambiguous, always accepted first.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return dateFromParts(Number(y), Number(m), Number(d));
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!slashMatch) return { ok: false, error: "unrecognized_format" };
  const [, a, b, y] = slashMatch;
  const first = Number(a);
  const second = Number(b);
  const year = Number(y);

  let day: number, month: number;
  if (hint === "MDY") {
    month = first; day = second;
  } else if (hint === "DMY") {
    day = first; month = second;
  } else {
    // auto: unambiguous cases first (one part > 12 tells us which is the day)
    if (first > 12 && second <= 12) { day = first; month = second; }
    else if (second > 12 && first <= 12) { month = first; day = second; }
    else { day = first; month = second; } // ambiguous — default to DMY (Gulf convention)
  }

  return dateFromParts(year, month, day);
}

function dateFromParts(year: number, month: number, day: number): ParsedValue<Date> {
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, error: "invalid_date" };
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return { ok: false, error: "invalid_date" };
  }
  return { ok: true, value: d };
}

export function parseImportBoolean(raw: string): ParsedValue<boolean> {
  const v = raw.trim().toLowerCase();
  if (["true", "yes", "1", "y", "نعم"].includes(v)) return { ok: true, value: true };
  if (["false", "no", "0", "n", "لا", ""].includes(v)) return { ok: true, value: false };
  return { ok: false, error: "not_boolean" };
}
