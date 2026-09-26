export interface PdfTableColumn {
  header: string;
  width?: string;
  /** Non-first columns default to the trailing edge (end-aligned); set explicitly to override. */
  align?: "start" | "end";
}

export interface PdfTableRow {
  /** Pre-escaped/pre-formatted cell HTML — callers control their own ltr-numbers wrapping per cell. */
  cells: string[];
  /** "sub" = invoice's nested rate-breakdown row (indented, muted, └-prefixed). */
  variant?: "default" | "sub";
}

export interface PdfTableFooterCell {
  content: string;
  colSpan?: number;
}

export interface PdfTableFooterRow {
  cells: (string | PdfTableFooterCell)[];
}

export interface PdfTableOptions {
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
  footerRow?: PdfTableFooterRow;
  /** Opt-in zebra striping for long documents (ledger, bank statement). */
  zebra?: boolean;
}

/**
 * One canonical ruled table — replaces invoice's table.items/table.payments,
 * bank statement's bare <table>, ledger's bare <table>, and reservation's
 * bare <table>, all of which independently reinvented the same ruled-table
 * pattern with slightly different CSS.
 */
export function renderTable(opts: PdfTableOptions): string {
  const theadCells = opts.columns
    .map((col, i) => {
      const alignClass = (col.align ?? (i === 0 ? "start" : "end")) === "end" ? " class=\"align-end\"" : "";
      const style = col.width ? ` style="width:${col.width}"` : "";
      return `<th${alignClass}${style}>${col.header}</th>`;
    })
    .join("");

  const tbodyRows = opts.rows
    .map((row) => {
      const rowClass = row.variant === "sub" ? ' class="row-sub"' : "";
      const cells = row.cells
        .map((cell, i) => {
          const alignClass = (opts.columns[i]?.align ?? (i === 0 ? "start" : "end")) === "end" ? " class=\"align-end\"" : "";
          return `<td${alignClass}>${cell}</td>`;
        })
        .join("");
      return `<tr${rowClass}>${cells}</tr>`;
    })
    .join("");

  const tfoot = opts.footerRow
    ? `<tfoot><tr>${opts.footerRow.cells
        .map((c) => (typeof c === "string" ? `<td>${c}</td>` : `<td${c.colSpan ? ` colspan="${c.colSpan}"` : ""}>${c.content}</td>`))
        .join("")}</tr></tfoot>`
    : "";

  return `<table class="pdf-table${opts.zebra ? " zebra" : ""}"><thead><tr>${theadCells}</tr></thead><tbody>${tbodyRows}</tbody>${tfoot}</table>`;
}
