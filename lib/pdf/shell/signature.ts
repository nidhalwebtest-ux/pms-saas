import { escHtml } from "../html";

export interface SignatureBlockOptions {
  lines: Array<{ label: string }>;
}

/**
 * Generic N-line signature block — lifted from reservation's .sig-grid/
 * .sig-line (previously the only document with a signature area) and
 * generalized so any document type can use it, not just reservations.
 */
export function renderSignatureBlock(opts: SignatureBlockOptions): string {
  const lines = opts.lines.map((l) => `<div class="sig-line">${escHtml(l.label)}</div>`).join("");
  return `<div class="sig-grid">${lines}</div>`;
}
