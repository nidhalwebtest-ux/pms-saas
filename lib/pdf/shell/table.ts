export interface PdfTableColumn {
  header: string;
  width?: string;
  /** Non-first columns default to the trailing edge (end-aligned); set explicitly to override. */
  align?: "start" | "end";
}

export interface PdfTableCell {
  content: string;
  colSpan?: number;
}

export interface PdfTableRow {
  /** Pre-escaped/pre-formatted cell HTML — callers control their own ltr-numbers wrapping per cell. A plain string is a normal single cell; use PdfTableCell for a merged cell. */
  cells: (string | PdfTableCell)[];
  /** "sub" = invoice's nested rate-breakdown row (indented, muted, └-prefixed). */
  variant?: "default" | "sub";
}

export type PdfTableFooterCell = PdfTableCell;

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
      let colIndex = 0;
      const cells = row.cells
        .map((cell) => {
          const i = colIndex;
          const isMerged = typeof cell !== "string";
          const span = isMerged ? cell.colSpan ?? 1 : 1;
          colIndex += span;
          const alignClass = (opts.columns[i]?.align ?? (i === 0 ? "start" : "end")) === "end" ? " class=\"align-end\"" : "";
          const spanAttr = isMerged && span > 1 ? ` colspan="${span}"` : "";
          const content = isMerged ? cell.content : cell;
          return `<td${alignClass}${spanAttr}>${content}</td>`;
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
