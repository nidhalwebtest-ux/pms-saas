/**
 * Reports registry — the sidebar groups and the report slugs.
 * `implemented: true` reports render their own view; the rest show a
 * "coming soon" placeholder (we build them one by one).
 */

export interface ReportItem {
  slug: string;
  label: string;
  starred?: boolean;
  implemented?: boolean;
}

export interface ReportGroup {
  key: string;
  label: string;
  items: ReportItem[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    key: "revenue",
    label: "Revenue",
    items: [
      { slug: "revenue-by-building", label: "Revenue by Building", starred: true, implemented: true },
      { slug: "revenue-by-tenant", label: "Revenue by Tenant", implemented: true },
      { slug: "revenue-by-unit-type", label: "Revenue by Unit Type" },
      { slug: "revenue-by-source", label: "Revenue by Source" },
      { slug: "revenue-trend", label: "Revenue Trend" },
      { slug: "revenue-comparison", label: "Revenue Comparison" },
    ],
  },
  {
    key: "occupancy",
    label: "Occupancy",
    items: [
      { slug: "occupancy-by-building", label: "Occupancy by Building", implemented: true },
      { slug: "occupancy-trend", label: "Occupancy Trend" },
      { slug: "vacancy-analysis", label: "Vacancy Analysis" },
      { slug: "avg-length-of-stay", label: "Avg. Length of Stay" },
      { slug: "khareef-performance", label: "Khareef Performance" },
    ],
  },
  {
    key: "financial",
    label: "Financial",
    items: [
      { slug: "aging-receivables", label: "Aging Receivables" },
      { slug: "outstanding-balances", label: "Outstanding Balances" },
      { slug: "cash-flow", label: "Cash Flow" },
      { slug: "pnl-by-building", label: "P&L by Building" },
      { slug: "expense-breakdown", label: "Expense Breakdown" },
    ],
  },
  {
    key: "operational",
    label: "Operational",
    items: [
      { slug: "receptionist-performance", label: "Receptionist Performance" },
      { slug: "tenant-reports", label: "Tenant Reports" },
      { slug: "maintenance", label: "Maintenance" },
      { slug: "booking-sources", label: "Booking Sources" },
      { slug: "cancellation-analysis", label: "Cancellation Analysis" },
    ],
  },
  {
    key: "tax",
    label: "Tax & Compliance",
    items: [
      { slug: "vat-summary", label: "VAT Summary" },
      { slug: "revenue-by-month", label: "Revenue by Month" },
      { slug: "annual-summary", label: "Annual Summary" },
    ],
  },
];

export const DEFAULT_REPORT_SLUG = "revenue-by-building";

export const ALL_REPORTS: ReportItem[] = REPORT_GROUPS.flatMap((g) => g.items);

export function findReport(slug: string): ReportItem | undefined {
  return ALL_REPORTS.find((r) => r.slug === slug);
}

// ── Date-range presets (shared by the report pages) ─────────────────────────
export const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "lastmonth", label: "Last month" },
  { key: "khareef", label: "Khareef season" },
] as const;

export type PresetKey = (typeof DATE_PRESETS)[number]["key"] | "custom";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const fmtRange = (a: Date, b: Date) => {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${a.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${b.toLocaleDateString("en-GB", o)}`;
};

/** Resolve a preset to a concrete [from,to] range (UTC dates) + display text. */
export function resolvePreset(
  preset: string,
  now: Date,
  customFrom?: string,
  customTo?: string,
): { preset: PresetKey; from: string; to: string; label: string; rangeText: string } {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  let from: Date, to: Date;
  let key = preset as PresetKey;

  switch (preset) {
    case "today": from = new Date(Date.UTC(y, m, d)); to = from; break;
    case "week": { const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); from = new Date(Date.UTC(y, m, d - dow)); to = new Date(Date.UTC(y, m, d - dow + 6)); break; }
    case "year": from = new Date(Date.UTC(y, 0, 1)); to = new Date(Date.UTC(y, 11, 31)); break;
    case "lastmonth": from = new Date(Date.UTC(y, m - 1, 1)); to = new Date(Date.UTC(y, m, 0)); break;
    case "quarter": { const q = Math.floor(m / 3); from = new Date(Date.UTC(y, q * 3, 1)); to = new Date(Date.UTC(y, q * 3 + 3, 0)); break; }
    case "khareef": from = new Date(Date.UTC(y, 5, 21)); to = new Date(Date.UTC(y, 8, 21)); break;
    case "custom":
      if (customFrom && customTo) { from = new Date(customFrom); to = new Date(customTo); break; }
      from = new Date(Date.UTC(y, m, 1)); to = new Date(Date.UTC(y, m + 1, 0)); key = "month"; break;
    case "month":
    default: from = new Date(Date.UTC(y, m, 1)); to = new Date(Date.UTC(y, m + 1, 0)); key = "month"; break;
  }

  const label = DATE_PRESETS.find((p) => p.key === key)?.label ?? "Custom";
  return { preset: key, from: ymd(from), to: ymd(to), label, rangeText: fmtRange(from, to) };
}
