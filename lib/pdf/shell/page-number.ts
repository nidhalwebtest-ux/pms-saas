export interface PageNumberFooterOptions {
  label?: (page: string, total: string) => string;
  color?: string;
  fontSize?: string;
}

/**
 * Chromium's native repeating footer-template HTML for "Page X of Y".
 * Only used by documents that can realistically span multiple pages
 * (tenant ledger, bank statement) — everything else stays single-page and
 * a page-number footer there would just be visual noise ("Page 1 of 1").
 *
 * Chromium's header/footer templates render in an isolated context that
 * cannot load the app's embedded @font-face CSS — only inline styles +
 * Chromium's built-in fonts work reliably here. This is a hard Puppeteer
 * constraint, not a design choice.
 */
export function buildPageNumberFooterTemplate(opts: PageNumberFooterOptions = {}): string {
  const color = opts.color ?? "#9ca3af";
  const fontSize = opts.fontSize ?? "9px";
  return `<div style="width:100%;font-size:${fontSize};color:${color};text-align:center;font-family:Helvetica,Arial,sans-serif;padding:0 40px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
}
