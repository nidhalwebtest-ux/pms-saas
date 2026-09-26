import { pdfFontFaceCss, PDF_FONT_STACK } from "../fonts";
import { brandRootCss, type PdfBranding } from "../branding";

/**
 * Canonical <style> block for every PDF document — the single source of truth
 * ported from the invoice template (the best-designed of the original 7).
 * All 7 routes compose from this instead of hand-writing their own CSS, so a
 * future visual change (a color, a spacing value) only has to happen once.
 */
export interface PdfStyleOptions {
  dir: "ltr" | "rtl";
  brand: PdfBranding;
  paperSize?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  /** CSS @page margin value. Default "0" (header/status-bar are full-bleed, body self-pads). */
  pageMargin?: string;
  /** Base body font-size. Default "13px". */
  baseFontSize?: string;
  /** .page max-width. Default "100%" — only receipt (A5) narrows this. */
  maxWidth?: string;
}

export function buildPdfBaseStyles(opts: PdfStyleOptions): string {
  const {
    dir,
    brand,
    paperSize = brand.paperSize,
    orientation = "portrait",
    pageMargin = "0",
    baseFontSize = "13px",
    maxWidth = "100%",
  } = opts;
  const isAr = dir === "rtl";
  const endAlign = isAr ? "left" : "right";

  return `
  ${pdfFontFaceCss()}
  ${brandRootCss(brand)}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${PDF_FONT_STACK}; font-size: ${baseFontSize}; color: #1f2937; background: #fff; direction: ${dir}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ltr-numbers { direction: ltr; unicode-bidi: embed; display: inline-block; }
  .page { max-width: ${maxWidth}; background: #fff; }

  /* Header — one canonical gradient-block design for every document. */
  .header { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header.compact { padding: 18px 24px; }
  .brand-logo { background:#fff; padding:6px 10px; border-radius:8px; margin-bottom:12px; display:inline-block; }
  .header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .header.compact h1 { font-size: 20px; }
  .org-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .org-detail { font-size: 12px; opacity: 0.82; line-height: 1.6; }
  .doc-meta { text-align: ${endAlign}; }
  .doc-meta table { border-collapse: collapse; }
  .doc-meta td { padding: 2px 0; font-size: 12px; }
  .doc-meta td:first-child { opacity: 0.75; padding-${isAr ? "left" : "right"}: 16px; text-align: ${isAr ? "right" : "left"}; }
  .doc-meta td:last-child { font-weight: 600; text-align: ${endAlign}; }
  .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: rgba(255,255,255,0.16); color: #fff; margin-top: 8px; }
  .status-pill .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block; }

  /* Status bar — full-width banner. Tone-based, not enum-based (see status.ts). */
  .status-bar { display: flex; align-items: center; gap: 12px; padding: 10px 40px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .status-bar.status-tone-success { background: #f0fdf4; color: #16a34a; border-bottom: 2px solid #bbf7d0; }
  .status-bar.status-tone-danger { background: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca; }
  .status-bar.status-tone-info { background: #eff6ff; color: #2563eb; border-bottom: 2px solid #bfdbfe; }
  .status-bar.status-tone-neutral { background: #f9fafb; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .status-bar.status-tone-warning { background: #fffbeb; color: #d97706; border-bottom: 2px solid #fde68a; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

  .body { padding: 32px 40px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #f3f4f6; display: flex; gap: 8px; align-items: baseline; }
  .section-label .sec { font-weight: 500; text-transform: none; letter-spacing: normal; color: #9ca3af; font-size: 10px; }

  /* Labeled field / labeled box — canonical replacement for the 6 synonym families found in the audit. */
  .field { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12.5px; }
  .field .lbl { color: #6b7280; min-width: 80px; }
  .field .val { font-weight: 500; color: #111827; }
  .field.emphasis .val { font-size: 16px; font-weight: 700; }
  .labeled-box { }
  .labeled-box.boxed { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  .labeled-box.highlight { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; background: #f9fafb; }
  .labeled-box .box-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 8px; }
  .labeled-box.highlight .field .val { font-size: 18px; font-weight: 800; color: #111827; }

  .tenant-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }

  /* Stacked field (label above value) — receipt's/ledger's pattern, distinct from the inline .field row above. */
  .field-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; display: flex; gap: 6px; align-items: baseline; }
  .field-label .sec { text-transform: none; letter-spacing: normal; color: #9ca3af; }
  .field-value { font-size: 13px; color: #111827; font-weight: 600; }
  .field-value-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }

  /* Table — one ruled style for every document, zebra-optional for long documents. */
  table.pdf-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.pdf-table thead th { padding: 8px 12px; text-align: ${isAr ? "right" : "left"}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; }
  table.pdf-table thead th.align-end { text-align: ${endAlign}; }
  table.pdf-table tbody td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  table.pdf-table tbody td.align-end { text-align: ${endAlign}; }
  table.pdf-table.zebra tbody tr:nth-child(even) { background: #fafafa; }
  table.pdf-table tbody tr.row-sub td { padding: 5px 12px 5px 28px; font-size: 11.5px; color: #6b7280; background: #fafafa; }
  table.pdf-table tbody tr.row-sub td:first-child::before { content: "↳ "; color: #d1d5db; font-family: Arial, sans-serif; }
  table.pdf-table tfoot td { padding: 9px 12px; border-top: 2px solid #e5e7eb; font-weight: 700; color: #111827; }

  /* Totals box — one generic highlight-row concept replacing invoice's .balance, return's .refund, etc. */
  .totals { display: flex; justify-content: flex-end; margin-bottom: 28px; }
  .totals-box { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; }
  .totals-row.tone-grand { font-size: 15px; font-weight: 800; color: #111827; padding: 8px 0 6px; border-top: 2px solid #e5e7eb; border-bottom: none; margin-top: 2px; }
  .totals-row.tone-positive { color: #16a34a; }
  .totals-row.tone-negative { font-size: 14px; font-weight: 700; color: #dc2626; padding-top: 6px; border-bottom: none; }
  .totals-row.tone-warning { font-weight: 700; color: #d97706; padding-top: 6px; border-bottom: none; }
  .totals-row.tone-muted { color: #6b7280; }

  .ink-stamp { display: inline-block; border: 3px solid #16a34a; border-radius: 8px; color: #16a34a; font-size: 22px; font-weight: 900; letter-spacing: 4px; padding: 4px 18px; transform: rotate(-3deg); opacity: 0.85; margin-top: 4px; }
  .ink-stamp.tone-danger { border-color: #dc2626; color: #dc2626; }
  .ink-stamp.tone-neutral { border-color: #6b7280; color: #6b7280; }

  .notes-section { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #92400e; margin-bottom: 24px; }
  .notes-section strong { color: #78350f; }

  .words-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 12px; font-style: italic; color: #4b5563; background: #f9fafb; margin-bottom: 20px; }
  .words-box .words-secondary { display: block; margin-top: 2px; opacity: 0.75; }

  .timeline { display: flex; flex-direction: column; gap: 0; margin-bottom: 20px; }
  .timeline .step { display: flex; gap: 12px; padding-bottom: 16px; position: relative; }
  .timeline .step:not(:last-child)::before { content: ""; position: absolute; ${isAr ? "right" : "left"}: 5px; top: 16px; bottom: 0; width: 2px; background: #e5e7eb; }
  .timeline .step .dot { width: 12px; height: 12px; border-radius: 50%; background: #e5e7eb; flex: none; margin-top: 2px; }
  .timeline .step.state-done .dot { background: #16a34a; }
  .timeline .step.state-current .dot { background: #2563eb; }
  .timeline .step.state-rejected .dot { background: #dc2626; }
  .timeline .step-label { font-weight: 700; font-size: 12.5px; color: #111827; }
  .timeline .step-sublabel { font-size: 11px; color: #9ca3af; margin-top: 1px; }

  .sig-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; margin-top: 32px; }
  .sig-line { border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 11px; color: #6b7280; text-align: center; }

  .footer { text-align: center; padding: 20px 40px 28px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; }
  .footer .footer-primary { font-size: 14px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
  .footer .footer-secondary { opacity: 0.75; margin-bottom: 4px; }
  .footer .footer-meta { font-size: 11px; color: #d1d5db; }

  @page { size: ${paperSize}${orientation === "landscape" ? " landscape" : ""}; margin: ${pageMargin}; }
`;
}
