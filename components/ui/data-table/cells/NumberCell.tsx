"use client";

export interface NumberCellProps {
  value: number | string | null | undefined;
  /** Decimal places. Default `0`. */
  decimals?: number;
  /** Show a suffix unit (e.g. " nights", "%"). */
  suffix?: string;
  /** Force LTR for numerals even inside RTL contexts. Default `true`. */
  ltr?: boolean;
  /** Render zero values as "—". */
  emptyOnZero?: boolean;
  /** Add color emphasis. */
  tone?: "default" | "positive" | "negative" | "muted";
}

const toneClass: Record<NonNullable<NumberCellProps["tone"]>, string> = {
  default: "text-fg",
  positive: "text-success-600",
  negative: "text-error-600",
  muted: "text-fg-tertiary",
};

/**
 * Right-aligned numeric cell. Uses `tabular-nums` so digits line up across
 * rows. The DataTable cell wrapper handles the actual `text-end` alignment;
 * this just renders content.
 */
export function NumberCell({
  value,
  decimals = 0,
  suffix,
  ltr = true,
  emptyOnZero,
  tone = "default",
}: NumberCellProps) {
  const n = value == null ? 0 : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  if (emptyOnZero && safe === 0) {
    return <span className="text-fg-tertiary">—</span>;
  }
  const formatted = safe.toFixed(decimals);
  return (
    <span
      className={`tabular-nums ${toneClass[tone]}`}
      dir={ltr ? "ltr" : undefined}
    >
      {formatted}
      {suffix}
    </span>
  );
}
