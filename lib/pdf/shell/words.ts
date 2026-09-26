import { escHtml } from "../html";

export interface AmountInWordsOptions {
  primary: string;
  secondary?: string;
}

/**
 * Pure presentational box for the "amount in words" convention (previously
 * receipt-only). The actual number-to-words conversion stays with whichever
 * route needs it — this only renders the resulting strings.
 */
export function renderAmountInWords(opts: AmountInWordsOptions): string {
  return `<div class="words-box">${escHtml(opts.primary)}${opts.secondary ? `<span class="words-secondary">${escHtml(opts.secondary)}</span>` : ""}</div>`;
}
