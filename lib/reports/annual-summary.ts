import { getPnlByBuilding } from "./pnl-by-building";
import { getOccupancyByBuilding } from "./occupancy-by-building";
import { getBookingSources } from "./booking-sources";
import { getCancellationAnalysis } from "./cancellation-analysis";
import { getRevenueByMonth } from "./revenue-by-month";
import { getCashFlow } from "./cash-flow";

/**
 * Annual Summary — a year-at-a-glance executive overview. Pure composition of
 * already-verified aggregations (no new data logic):
 *   financial   ← P&L by Building (revenue, expenses, net, margin)
 *   occupancy   ← Occupancy by Building
 *   bookings    ← Booking Sources
 *   churn       ← Cancellation Analysis
 *   monthly P&L ← Revenue by Month (revenue) + Cash Flow monthly (expenses)
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface AnnualMonth {
  key: string;
  start: string;
  revenue: number;
  expenses: number;
  profit: number;
  cumulative: number;
}
export interface AnnualReport {
  kpis: {
    revenue: number;
    expenses: number;
    netProfit: number;
    margin: number | null;
    occupancy: number;
    occupiedNights: number;
    availableNights: number;
    bookings: number;
    bookedValue: number;
    cancellations: number;
    cancellationRate: number;
  };
  highlights: {
    topBuilding: { name: string; net: number } | null;
    topSource: { source: string; bookings: number } | null;
  };
  months: AnnualMonth[];
  rangeDays: number;
}

export async function getAnnualSummary(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<AnnualReport> {
  const [pnl, occ, bs, ca, rbm, cf] = await Promise.all([
    getPnlByBuilding(params),
    getOccupancyByBuilding(params),
    getBookingSources(params),
    getCancellationAnalysis(params),
    getRevenueByMonth(params),
    getCashFlow({ ...params, bucket: "month" }),
  ]);

  const expByMonth = new Map(cf.buckets.map((b) => [b.key, b.expenses]));
  let running = 0;
  const months: AnnualMonth[] = rbm.months.map((m) => {
    const revenue = m.net;
    const expenses = r3(expByMonth.get(m.key) ?? 0);
    const profit = r3(revenue - expenses);
    running = r3(running + profit);
    return { key: m.key, start: m.start, revenue, expenses, profit, cumulative: running };
  });

  const topBuilding = pnl.buildings[0] ? { name: pnl.buildings[0].name, net: pnl.buildings[0].net } : null;
  const topSource = bs.sources[0] ? { source: bs.sources[0].source, bookings: bs.sources[0].bookings } : null;

  return {
    kpis: {
      revenue: pnl.kpis.revenue,
      expenses: pnl.kpis.expenses,
      netProfit: pnl.kpis.net,
      margin: pnl.kpis.margin,
      occupancy: occ.kpis.occupancy,
      occupiedNights: occ.kpis.occupiedNights,
      availableNights: occ.kpis.availableNights,
      bookings: bs.kpis.bookings,
      bookedValue: bs.kpis.value,
      cancellations: ca.kpis.cancellations,
      cancellationRate: ca.kpis.rate,
    },
    highlights: { topBuilding, topSource },
    months,
    rangeDays: pnl.rangeDays,
  };
}
