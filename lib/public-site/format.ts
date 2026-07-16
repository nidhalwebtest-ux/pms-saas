import type { SiteLang } from "./i18n";

/** OMR uses 3 decimal places (baisa). Formats money for the visitor's locale. */
export function formatMoney(amount: number, currency: string, lang: SiteLang): string {
  const decimals = currency === "OMR" ? 3 : 2;
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-OM" : "en-OM", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals)} ${currency}`;
  }
}

export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/** Whole nights between two YYYY-MM-DD strings (half-open, matches PMS). */
export function nightsBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + "T00:00:00Z").getTime();
  const b = new Date(endISO + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Localised short date (e.g. "12 Aug"). */
export function formatDate(iso: string, lang: SiteLang): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-OM" : "en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(d);
}

/** Normalise a WhatsApp number to a wa.me-friendly digits string. */
export function waNumber(raw: string | null | undefined): string {
  return (raw || "").replace(/[^\d]/g, "");
}
