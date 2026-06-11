import { getRevenueTrend, type RevTrendBucket } from "./revenue-trend";

/**
 * Revenue by Month — a monthly net-revenue register (for annual / tax review).
 * Reuses getRevenueTrend forced to monthly buckets and adds a running cumulative
 * column. Same posting basis: net = issued invoices − active returns.
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface RevMonthBucket extends RevTrendBucket {
  cumulative: number;
}
export interface RevByMonthReport {
  months: RevMonthBucket[];
  kpis: {
    total: number;
    invoiced: number;
    returned: number;
    txCount: number;
    avgPerMonth: number;
    monthCount: number;
  };
  rangeDays: number;
}

export async function getRevenueByMonth(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevByMonthReport> {
  const trend = await getRevenueTrend({ ...params, bucket: "month" });

  let running = 0;
  const months: RevMonthBucket[] = trend.buckets.map((b) => {
    running = r3(running + b.net);
    return { ...b, cumulative: running };
  });

  const k = trend.kpis;
  return {
    months,
    kpis: {
      total: k.total,
      invoiced: k.invoiced,
      returned: k.returned,
      txCount: k.txCount,
      avgPerMonth: months.length > 0 ? r3(k.total / months.length) : 0,
      monthCount: months.length,
    },
    rangeDays: trend.rangeDays,
  };
}
