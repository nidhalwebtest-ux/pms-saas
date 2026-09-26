import { escHtml } from "../html";
import { logoHtml, type PdfBranding } from "../branding";
import { renderStatusPill, type StatusTone } from "./status";

export interface PdfHeaderMetaRow {
  label: string;
  value: string;
  ltrNumbers?: boolean;
}

export interface PdfHeaderOptions {
  brand: PdfBranding;
  orgName: string;
  /** Caller pre-formats (address, city+area, phone) — the shell doesn't know the org schema. */
  orgAddressLines: string[];
  /** Already-translated document title, e.g. "INVOICE", "PAYMENT RECEIPT". */
  docTitle: string;
  /** Right-side meta table (invoice no / date / status / etc). */
  metaRows: PdfHeaderMetaRow[];
  /** Optional inline status pill shown under the title (reservation's header-badge use case). */
  statusPill?: { label: string; tone: StatusTone };
  /** A5/compact documents get tighter padding and a smaller title. */
  compact?: boolean;
  /** Extra pre-rendered HTML appended to the right-side meta column, below the meta table (e.g. reservation's large document-number figure). */
  metaExtra?: string;
}

/**
 * One canonical gradient-block header for every document — ports the
 * invoice template's header verbatim (the best-designed of the original 7)
 * so every PDF shares one visual identity instead of 3 incompatible designs.
 */
export function renderPdfHeader(opts: PdfHeaderOptions): string {
  const { brand, orgName, orgAddressLines, docTitle, metaRows, statusPill, compact, metaExtra } = opts;
  const logo = logoHtml(brand);

  const metaRowsHtml = metaRows
    .map(
      (row) =>
        `<tr><td>${escHtml(row.label)}:</td><td${row.ltrNumbers ? ' class="ltr-numbers"' : ""}>${escHtml(row.value)}</td></tr>`,
    )
    .join("");

  return `
  <div class="header${compact ? " compact" : ""}">
    <div>
      ${logo ? `<div class="brand-logo">${logo}</div>` : ""}
      <div class="org-name">${escHtml(orgName)}</div>
      ${orgAddressLines.map((line) => `<div class="org-detail">${escHtml(line)}</div>`).join("")}
      <div style="margin-top:16px"><h1>${escHtml(docTitle)}</h1></div>
      ${statusPill ? renderStatusPill(statusPill) : ""}
    </div>
    <div class="doc-meta">
      <table><tbody>${metaRowsHtml}</tbody></table>
      ${metaExtra ?? ""}
    </div>
  </div>`;
}
