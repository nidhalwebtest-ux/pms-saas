import { prisma } from "@/lib/prisma";

/**
 * Org-level PDF customization shared by every document template. One small query
 * per render returns branding (logo, brand colour, footer) + section toggles.
 * Templates inject brandRootCss() into their <style> and reference var(--brand)
 * / var(--brand-dark) for the header + primary accents; status colours stay
 * semantic. logoHtml() renders the org logo when enabled.
 */

export interface PdfBranding {
  brandColor: string;
  brandColorDark: string;
  logo: string | null;
  footerText: string | null;
  footerTextAr: string | null;
  paperSize: "A4" | "Letter";
  showLogo: boolean;
  showSignature: boolean;
  showPaymentHistory: boolean;
  showNotes: boolean;
}

const DEFAULT_BRAND = "#1d4ed8";

/** Darken a #rrggbb hex by `amt` (0..1) for the header gradient end. */
function darken(hex: string, amt = 0.18): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export async function getPdfBranding(orgId: string): Promise<PdfBranding> {
  const o = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      logo: true,
      pdfBrandColor: true, pdfFooterText: true, pdfFooterTextAr: true,
      pdfPaperSize: true, pdfShowLogo: true, pdfShowSignature: true,
      pdfShowPaymentHistory: true, pdfShowNotes: true,
    },
  });
  const brandColor = o?.pdfBrandColor || DEFAULT_BRAND;
  return {
    brandColor,
    brandColorDark: darken(brandColor),
    logo: o?.logo ?? null,
    footerText: o?.pdfFooterText ?? null,
    footerTextAr: o?.pdfFooterTextAr ?? null,
    paperSize: (o?.pdfPaperSize === "Letter" ? "Letter" : "A4"),
    showLogo: o?.pdfShowLogo ?? true,
    showSignature: o?.pdfShowSignature ?? true,
    showPaymentHistory: o?.pdfShowPaymentHistory ?? true,
    showNotes: o?.pdfShowNotes ?? true,
  };
}

/** CSS custom properties to drop at the top of a template's <style>. */
export function brandRootCss(b: PdfBranding): string {
  return `:root{--brand:${b.brandColor};--brand-dark:${b.brandColorDark};}`;
}

/** Logo <img> for a header (returns "" when disabled or absent). */
export function logoHtml(b: PdfBranding, opts?: { height?: number; className?: string }): string {
  if (!b.showLogo || !b.logo) return "";
  const h = opts?.height ?? 40;
  const cls = opts?.className ? ` class="${opts.className}"` : "";
  return `<img src="${b.logo}" alt=""${cls} style="height:${h}px;max-width:170px;object-fit:contain;display:block" />`;
}

/** Resolve the footer line for a locale, falling back to a default. */
export function footerLine(b: PdfBranding, isAr: boolean, fallback: string): string {
  const custom = isAr ? (b.footerTextAr || b.footerText) : (b.footerText);
  return (custom && custom.trim()) || fallback;
}
