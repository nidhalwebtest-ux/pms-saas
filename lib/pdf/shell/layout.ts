import { escHtml } from "../html";

/** Small uppercase section heading — invoice's exact .section-label pattern. Optional bilingual sibling line. */
export function renderSectionLabel(text: string, secondary?: string): string {
  return `<div class="section-label"><span>${escHtml(text)}</span>${secondary ? `<span class="sec">${escHtml(secondary)}</span>` : ""}</div>`;
}

export interface LabeledFieldOptions {
  label: string;
  value: string;
  ltrNumbers?: boolean;
  emphasis?: boolean;
}

/**
 * One canonical label/value row — replaces the 6 synonym families the audit
 * found (.info-row, .field .lbl/.val, .field-label/.field-value, .box .l/.v,
 * .meta-block .label/.value, .summary-box .s-label/.s-value).
 */
export function renderField(opts: LabeledFieldOptions): string {
  const valueClass = [opts.ltrNumbers ? "ltr-numbers" : "", "val"].filter(Boolean).join(" ");
  const label = opts.label ? `<span class="lbl">${escHtml(opts.label)}</span>` : "";
  return `<div class="field${opts.emphasis ? " emphasis" : ""}">${label}<span class="${valueClass}">${escHtml(opts.value)}</span></div>`;
}

export interface StackedFieldOptions {
  label: string;
  labelSecondary?: string;
  value: string;
  valueSub?: string;
  ltrNumbers?: boolean;
  dir: "ltr" | "rtl";
}

/**
 * Stacked label-above-value field (small caps label, bold value below) —
 * receipt's/ledger's .field-label/.field-value pattern, distinct from
 * renderField's inline label:value row. Supports an optional bilingual
 * secondary label line for documents that show both locales at once.
 */
export function renderFieldStacked(opts: StackedFieldOptions): string {
  const secondaryDir = opts.dir === "rtl" ? "ltr" : "rtl";
  const valueClass = [opts.ltrNumbers ? "ltr-numbers" : ""].filter(Boolean).join(" ");
  return `
  <div>
    <div class="field-label">${escHtml(opts.label)}${opts.labelSecondary ? `<span class="sec" style="direction:${secondaryDir}">${escHtml(opts.labelSecondary)}</span>` : ""}</div>
    <div class="field-value ${valueClass}">${escHtml(opts.value)}</div>
    ${opts.valueSub ? `<div class="field-value-sub" dir="${secondaryDir}">${escHtml(opts.valueSub)}</div>` : ""}
  </div>`;
}

export interface LabeledBoxOptions {
  title?: string;
  fields: LabeledFieldOptions[];
  /** plain = invoice's borderless field stack. boxed = return's bordered detail panel. highlight = a brand-tinted stat box. */
  variant?: "plain" | "boxed" | "highlight";
}

export function renderLabeledBox(opts: LabeledBoxOptions): string {
  const variant = opts.variant ?? "plain";
  const cls = variant === "plain" ? "labeled-box" : `labeled-box ${variant}`;
  return `<div class="${cls}">${opts.title ? `<div class="box-title">${escHtml(opts.title)}</div>` : ""}${opts.fields.map(renderField).join("")}</div>`;
}

/** Generalization of invoice's .two-col. */
export function renderTwoCol(left: string, right: string): string {
  return `<div class="two-col"><div>${left}</div><div>${right}</div></div>`;
}

/** Generalization of reservation's .four-col (and any other N-column grid). */
export function renderGrid(cols: 2 | 3 | 4, cells: string[]): string {
  return `<div class="grid-${cols}">${cells.map((c) => `<div>${c}</div>`).join("")}</div>`;
}
