import type { Decimal } from "@prisma/client/runtime/library";

const THREE_DECIMAL_CURRENCIES = new Set(["OMR", "BHD", "KWD", "JOD", "TND", "LYD", "IQD"]);

export function getCurrencyDecimals(currencyCode: string): number {
  return THREE_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase()) ? 3 : 2;
}

/**
 * Render a monetary amount with the org's currency code.
 * Always renders the code suffix (no symbols) for consistency across LTR/RTL
 * and for currencies without a Unicode symbol (e.g. OMR).
 *
 *   formatCurrency(320.5, "OMR") → "320.500 OMR"
 *   formatCurrency(0,     "USD") → "0.00 USD"
 */
export function formatCurrency(
  amount: number | string | Decimal | null | undefined,
  currencyCode: string = "OMR",
  opts: { decimals?: number } = {},
): string {
  const n = amount == null ? 0 : Number(amount);
  const code = (currencyCode || "OMR").toUpperCase();
  const decimals = opts.decimals ?? getCurrencyDecimals(code);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(decimals)} ${code}`;
}

/**
 * Bare numeric formatting with the right decimal precision for the currency,
 * without the currency code suffix. Use when the code is rendered separately
 * (e.g. in a column already labelled "Amount (OMR)").
 */
export function formatAmount(
  amount: number | string | Decimal | null | undefined,
  currencyCode: string = "OMR",
  opts: { decimals?: number } = {},
): string {
  const n = amount == null ? 0 : Number(amount);
  const decimals = opts.decimals ?? getCurrencyDecimals((currencyCode || "OMR").toUpperCase());
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toFixed(decimals);
}
