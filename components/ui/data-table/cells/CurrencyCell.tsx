"use client";

import { formatAmount, getCurrencyDecimals } from "@/lib/format-currency";

export interface CurrencyCellProps {
  value: number | string | null | undefined;
  /** ISO currency code. Default `"OMR"`. */
  currency?: string;
  /** Append the currency code as a suffix. Default `true`. */
  showCode?: boolean;
  /** Color emphasis — positive = green, negative = red. */
  tone?: "default" | "positive" | "negative" | "muted";
  /** Render zero as "—". */
  emptyOnZero?: boolean;
  /** Override the decimal places (otherwise inferred from the currency). */
  decimals?: number;
}

const toneClass: Record<NonNullable<CurrencyCellProps["tone"]>, string> = {
  default: "text-fg",
  positive: "text-success-600 font-medium",
  negative: "text-error-600 font-medium",
  muted: "text-fg-tertiary",
};

/**
 * Currency cell — uses `lib/format-currency.formatAmount()` so the decimal
 * count matches the org-wide rule (3 for OMR / GCC, 2 elsewhere). Always
 * renders the numeric portion in LTR + `tabular-nums` so columns align.
 */
export function CurrencyCell({
  value,
  currency = "OMR",
  showCode = true,
  tone = "default",
  emptyOnZero,
  decimals,
}: CurrencyCellProps) {
  const n = value == null ? 0 : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  if (emptyOnZero && safe === 0) {
    return <span className="text-fg-tertiary">—</span>;
  }
  const code = currency.toUpperCase();
  const d = decimals ?? getCurrencyDecimals(code);
  const formatted = formatAmount(safe, code, { decimals: d });
  return (
    <span className={`tabular-nums ${toneClass[tone]}`} dir="ltr">
      {formatted}
      {showCode && <span className="ms-1 text-xs text-fg-tertiary">{code}</span>}
    </span>
  );
}
