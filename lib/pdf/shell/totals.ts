import { escHtml } from "../html";

export type TotalsRowTone = "default" | "grand" | "positive" | "negative" | "muted";

export interface TotalsRow {
  label: string;
  value: string;
  tone?: TotalsRowTone;
  ltrNumbers?: boolean;
}

export interface TotalsBoxOptions {
  rows: TotalsRow[];
  minWidth?: string;
}

/**
 * One generic highlight-row concept — replaces invoice's
 * .totals-row/.totals-row.grand/.totals-row.balance(.zero) AND return's
 * parallel-but-differently-named .refund.due/.done/.none. Also replaces
 * receipt's/expense's single-value .amount-box (pass one row, tone:"grand").
 * The grand-row color (#111827) is now defined exactly once, fixing the
 * drift the audit found (return's .totals-row.grand used var(--brand-dark)
 * instead of invoice's #111827 — same class name, different color).
 */
export function renderTotalsBox(opts: TotalsBoxOptions): string {
  const rows = opts.rows
    .map((row) => {
      const tone = row.tone && row.tone !== "default" ? ` tone-${row.tone}` : "";
      const valueClass = [row.ltrNumbers ? "ltr-numbers" : ""].filter(Boolean).join(" ");
      return `<div class="totals-row${tone}"><span>${escHtml(row.label)}</span><span class="${valueClass}">${escHtml(row.value)}</span></div>`;
    })
    .join("");
  const style = opts.minWidth ? ` style="min-width:${opts.minWidth}"` : "";
  return `<div class="totals"><div class="totals-box"${style}>${rows}</div></div>`;
}
