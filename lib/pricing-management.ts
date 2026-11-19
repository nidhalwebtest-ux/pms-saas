/**
 * Shared constants/helpers for Pricing Management (Roadmap item 6) — safe for
 * client and server.
 */

/** Unit types (same list as UnitForm / the CSV import). */
export const UNIT_TYPES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "SUITE"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

/** Season colour presets for the calendar / list. */
export const SEASON_COLORS = ["#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];

/** Season dates are stored at UTC midnight (start) / UTC end-of-day (end), like
 *  UnitPrice seasons → the calendar day is the UTC date. */
export function seasonYmd(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Decimal-ish → "35.200" (3 decimals) for inputs and tables. */
export function fmtRate(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : "";
}
