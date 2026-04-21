import { cookies } from "next/headers";
import { format } from "date-fns";
import { ar as arDateLocale, enGB as enDateLocale } from "date-fns/locale";
import { defaultLocale, dirFor, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import type { DisplayStatus } from "@/lib/reservation-status";

export type PdfLocaleContext = {
  locale: Locale;
  otherLocale: Locale;
  dir: "ltr" | "rtl";
  fmtFull: (date: Date | string | null) => string;
  fmtLong: (date: Date | string | null) => string;
  fmtShort: (date: Date | string | null) => string;
};

export async function getPdfLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export function dateFnsLocaleFor(locale: Locale) {
  return locale === "ar" ? arDateLocale : enDateLocale;
}

export function makePdfDateFormatters(locale: Locale) {
  const dl = dateFnsLocaleFor(locale);
  const fmtFull = (d: Date | string | null) =>
    d ? format(new Date(d), "EEEE, d MMMM yyyy", { locale: dl }) : "—";
  const fmtLong = (d: Date | string | null) =>
    d ? format(new Date(d), "d MMMM yyyy", { locale: dl }) : "—";
  const fmtShort = (d: Date | string | null) =>
    d ? format(new Date(d), "d MMM yyyy", { locale: dl }) : "—";
  return { fmtFull, fmtLong, fmtShort };
}

export async function getPdfLocaleContext(): Promise<PdfLocaleContext> {
  const locale = await getPdfLocale();
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const { fmtFull, fmtLong, fmtShort } = makePdfDateFormatters(locale);
  return { locale, otherLocale, dir: dirFor(locale), fmtFull, fmtLong, fmtShort };
}

export const DISPLAY_STATUS_KEY: Record<DisplayStatus, string> = {
  Upcoming: "upcoming",
  "Arriving Today": "arrivingToday",
  "Overdue Arrival": "overdueArrival",
  "In House": "inHouse",
  "Due Checkout": "dueCheckout",
  Overstay: "overstay",
  "Checked Out": "checkedOut",
  Cancelled: "cancelled",
  "No Show": "noShow",
  Pending: "upcoming",
};
