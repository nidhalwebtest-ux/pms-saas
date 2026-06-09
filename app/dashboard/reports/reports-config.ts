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
      { slug: "occupancy-by-building", label: "Occupancy by Building" },
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
