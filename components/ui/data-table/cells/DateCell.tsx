"use client";

import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { useLocale } from "next-intl";

export interface DateCellProps {
  value: Date | string | null | undefined;
  /** date-fns format string. Default `"dd MMM yyyy"`. */
  format?: string;
  /** Empty-state label. Default em-dash. */
  fallback?: string;
  /** Color emphasis. */
  tone?: "default" | "muted" | "urgent" | "today";
  /** Render in monospace (for compact, aligned date columns). */
  mono?: boolean;
}

const toneClass: Record<NonNullable<DateCellProps["tone"]>, string> = {
  default: "text-fg",
  muted: "text-fg-tertiary",
  urgent: "text-error-600 font-medium",
  today: "text-warning-700 font-semibold",
};

/**
 * Date cell — formats via `date-fns` with the active next-intl locale. Returns
 * a graceful fallback for null / invalid inputs (no exceptions to the table).
 */
export function DateCell({
  value,
  format = "dd MMM yyyy",
  fallback = "—",
  tone = "default",
  mono,
}: DateCellProps) {
  if (value == null) {
    return <span className="text-fg-tertiary">{fallback}</span>;
  }
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-fg-tertiary">{fallback}</span>;
  }
  return (
    <span className={`${toneClass[tone]} ${mono ? "font-mono text-[13px]" : ""}`}>
      {fmtDateFns(date, format, { locale: dateFnsLocale })}
    </span>
  );
}
