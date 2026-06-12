import { INTER_400, INTER_600, INTER_700, CAIRO_400, CAIRO_700 } from "./fonts.generated";

/**
 * Embedded bilingual fonts for PDF templates.
 *
 * Fonts are base64-inlined as @font-face data URIs so rendering is identical in
 * every environment — including serverless Chromium, which ships with NO system
 * fonts (Arabic would otherwise render as empty boxes). Latin = Inter, Arabic =
 * Cairo. The shared stack lists Inter first (clean Latin/numerals) then Cairo
 * (covers Arabic), so mixed EN/AR content renders correctly without per-element
 * font switching.
 */

const face = (family: string, weight: number, b64: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(data:font/woff2;base64,${b64}) format('woff2');}`;

/** All @font-face rules — inject once into each template's <style>. */
export function pdfFontFaceCss(): string {
  return [
    face("Inter", 400, INTER_400),
    face("Inter", 600, INTER_600),
    face("Inter", 700, INTER_700),
    face("Cairo", 400, CAIRO_400),
    face("Cairo", 700, CAIRO_700),
  ].join("");
}

/** Default bilingual font stack: Latin via Inter, Arabic via Cairo. */
export const PDF_FONT_STACK = "'Inter','Cairo',-apple-system,sans-serif";
