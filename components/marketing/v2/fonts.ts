import { Cairo, Poppins } from "next/font/google";

/* Landing v2 type, matching the promo video: Cairo for all text (Arabic + Latin),
 * Poppins 600 for the "Binaya" wordmark only. Scoped to the marketing page via the
 * class names below, so the dashboard keeps IBM Plex. */

export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-poppins",
  display: "swap",
});

/** Put on the landing page root: exposes both variables and sets Cairo as the font. */
export const landingFontClass = `${cairo.variable} ${poppins.variable} ${cairo.className}`;
