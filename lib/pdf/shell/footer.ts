import { escHtml } from "../html";

export interface PdfFooterOptions {
  /** Already resolved via footerLine(brand, isAr, fallback). */
  primaryLine: string;
  /** Bilingual sibling line (tOther equivalent) — omit for single-language docs. */
  secondaryLine?: string;
  /** e.g. "Org Name · City · Phone", already composed by the caller. */
  metaLine?: string;
}

/** One canonical footer — replaces ledger's .page-footer and every ad hoc bilingual footer pairing. */
export function renderPdfFooter(opts: PdfFooterOptions): string {
  return `
  <div class="footer">
    <div class="footer-primary">${escHtml(opts.primaryLine)}</div>
    ${opts.secondaryLine ? `<div class="footer-secondary">${escHtml(opts.secondaryLine)}</div>` : ""}
    ${opts.metaLine ? `<div class="footer-meta">${opts.metaLine}</div>` : ""}
  </div>`;
}
