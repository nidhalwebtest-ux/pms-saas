"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ar as arLocale, enUS as enLocale, type Locale } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useFormatCurrency } from "@/lib/org-context";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPIs {
  revenueMTD: number;    revenueTrend: number | null;
  expensesMTD: number;   expensesTrend: number | null;
  noi: number;           noiTrend: number | null;
  occupancyRate: number;
  outstanding: number;   outstandingCount: number;
}
interface RevPoint   { date: string; revenue: number }
interface ExpRow     { category: string; amount: number; pct: number }
interface AgingBuckets {
  current: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number;
}
interface AgingCounts {
  current: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number;
}
interface PerfRow {
  userId: string; name: string; role: string;
  checkins: number; checkouts: number; created: number; payments: number; total: number;
}
interface BuildingRow {
  id: string; name: string; totalUnits: number; occupied: number;
  occupancyPct: number; revenue: number; expenses: number; noi: number;
}
interface OccTrendPoint { month: string; revenue: number }
interface Alert {
  type: string; severity: "red" | "amber" | "blue"; message: string; link?: string;
}
interface ManagerData {
  kpis: KPIs;
  revenueTrend: RevPoint[];
  expenseBreakdown: ExpRow[];
  aging: { buckets: AgingBuckets; counts: AgingCounts };
  receptionistPerformance: PerfRow[];
  buildingComparison: BuildingRow[];
  occupancyTrend: OccTrendPoint[];
  alerts: Alert[];
}

// ── Inline SVG Charts (no external dependencies) ──────────────────────────────

const SVG_W = 600;
const SVG_H = 200;
const PAD = { l: 56, r: 8, t: 8, b: 28 };
const PLOT_W = SVG_W - PAD.l - PAD.r;
const PLOT_H = SVG_H - PAD.t - PAD.b;

function MinimalLineChart({ data, noDataLabel, dateFnsLocale }: { data: RevPoint[]; noDataLabel: string; dateFnsLocale: Locale }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; val: string } | null>(null);
  const omr = useFormatCurrency();

  if (data.length === 0)
    return <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">{noDataLabel}</div>;

  const maxVal = Math.max(...data.map((d) => d.revenue), 0.001);
  const n = data.length;
  const xPx = (i: number) => PAD.l + (n < 2 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const yPx = (v: number) => PAD.t + PLOT_H - (v / maxVal) * PLOT_H;

  const pathD = data
    .map((pt, i) => `${i === 0 ? "M" : "L"}${xPx(i).toFixed(1)},${yPx(pt.revenue).toFixed(1)}`)
    .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: maxVal * f, y: yPx(maxVal * f) }));
  const xLabelIdxs = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="200" style={{ overflow: "visible" }}>
        {yTicks.map(({ y, v }) => (
          <g key={v}>
            <line x1={PAD.l} y1={y} x2={SVG_W - PAD.r} y2={y} stroke="#f0f0f0" strokeWidth={1} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        {xLabelIdxs.map((i) => (
          <text key={i} x={xPx(i)} y={SVG_H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {format(parseISO(data[i].date), "d MMM", { locale: dateFnsLocale })}
          </text>
        ))}
        <path d={pathD} fill="none" stroke="#185FA5" strokeWidth={2} strokeLinejoin="round" />
        {data.map((pt, i) => (
          <circle
            key={i}
            cx={xPx(i)}
            cy={yPx(pt.revenue)}
            r={4}
            fill="white"
            stroke="#185FA5"
            strokeWidth={2}
            className="cursor-pointer opacity-0 hover:opacity-100"
            onMouseEnter={() =>
              setTip({
                x: xPx(i),
                y: yPx(pt.revenue),
                label: format(parseISO(pt.date), "d MMM yyyy", { locale: dateFnsLocale }),
                val: omr(pt.revenue),
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
        {tip && (
          <g>
            <rect
              x={Math.min(tip.x - 4, SVG_W - 120)}
              y={tip.y - 38}
              width={116}
              height={32}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text x={Math.min(tip.x - 4, SVG_W - 120) + 8} y={tip.y - 22} fontSize={9} fill="#d1d5db">
              {tip.label}
            </text>
            <text x={Math.min(tip.x - 4, SVG_W - 120) + 8} y={tip.y - 11} fontSize={10} fill="white" fontWeight="bold">
              {tip.val}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function MinimalBarChart({ data, noDataLabel }: { data: OccTrendPoint[]; noDataLabel: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; val: string } | null>(null);
  const omr = useFormatCurrency();

  if (data.length === 0)
    return <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">{noDataLabel}</div>;

  const maxVal = Math.max(...data.map((d) => d.revenue), 0.001);
  const n = data.length;
  const slotW = PLOT_W / n;
  const barW = slotW * 0.6;
  const xCenter = (i: number) => PAD.l + i * slotW + slotW / 2;
  const barX = (i: number) => xCenter(i) - barW / 2;
  const barH = (v: number) => (v / maxVal) * PLOT_H;
  const barY = (v: number) => PAD.t + PLOT_H - barH(v);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: maxVal * f,
    y: PAD.t + PLOT_H - (maxVal * f / maxVal) * PLOT_H,
  }));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="200" style={{ overflow: "visible" }}>
        {yTicks.map(({ y, v }) => (
          <g key={v}>
            <line x1={PAD.l} y1={y} x2={SVG_W - PAD.r} y2={y} stroke="#f0f0f0" strokeWidth={1} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        {data.map((pt, i) => (
          <g key={i}>
            <rect
              x={barX(i)}
              y={barY(pt.revenue)}
              width={barW}
              height={Math.max(barH(pt.revenue), 2)}
              rx={4}
              fill="#185FA5"
              className="cursor-pointer hover:fill-indigo-400 transition-colors"
              onMouseEnter={() =>
                setTip({ x: xCenter(i), y: barY(pt.revenue), label: pt.month, val: omr(pt.revenue) })
              }
              onMouseLeave={() => setTip(null)}
            />
            <text x={xCenter(i)} y={SVG_H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {pt.month}
            </text>
          </g>
        ))}
        {tip && (
          <g>
            <rect
              x={Math.min(tip.x - 4, SVG_W - 120)}
              y={tip.y - 38}
              width={116}
              height={32}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text x={Math.min(tip.x - 4, SVG_W - 120) + 8} y={tip.y - 22} fontSize={9} fill="#d1d5db">
              {tip.label}
            </text>
            <text x={Math.min(tip.x - 4, SVG_W - 120) + 8} y={tip.y - 11} fontSize={10} fill="white" fontWeight="bold">
              {tip.val}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function TrendBadge({
  value, inverse = false, vsLastMonthLabel,
}: { value: number | null; inverse?: boolean; vsLastMonthLabel: string }) {
  if (value === null) return null;
  const positive = inverse ? value < 0 : value > 0;
  const pctStr   = `${value > 0 ? "+" : ""}${value}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {positive
        ? <ArrowTrendingUpIcon className="h-3 w-3" />
        : <ArrowTrendingDownIcon className="h-3 w-3" />}
      <span className="ltr-numbers">{pctStr}</span> {vsLastMonthLabel}
    </span>
  );
}

function KpiCard({
  label, value, trend, inverseTrend = false, sub, color, icon: Icon, vsLastMonthLabel,
}: {
  label: string; value: string; trend: number | null; inverseTrend?: boolean;
  sub?: string; color: string; icon: React.ElementType; vsLastMonthLabel: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {trend !== null && (
        <div className="mt-2">
          <TrendBadge value={trend} inverse={inverseTrend} vsLastMonthLabel={vsLastMonthLabel} />
        </div>
      )}
    </div>
  );
}

const ALERT_STYLES: Record<string, string> = {
  red:   "bg-red-50 border-red-200 text-red-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  blue:  "bg-blue-50 border-blue-200 text-blue-800",
};
const ALERT_ICONS: Record<string, string> = {
  red: "🔴", amber: "🟡", blue: "🔵",
};

// ── Main Component ─────────────────────────────────────────────────────────────

export function ManagerView({
  propertyId,
  variant = "full",
}: {
  propertyId: string;
  /** "full" = the standalone manager view; "highlights" = only building
   *  performance, expense breakdown, and aging receivables (merged dashboard). */
  variant?: "full" | "highlights";
}) {
  const highlightsOnly = variant === "highlights";
  const t        = useTranslations("dashboard.manager");
  const tKpis    = useTranslations("dashboard.manager.kpis");
  const tTrend   = useTranslations("dashboard.manager.trend");
  const tCharts  = useTranslations("dashboard.manager.charts");
  const tBP      = useTranslations("dashboard.manager.buildingPerf");
  const tBPTbl   = useTranslations("dashboard.manager.buildingPerf.table");
  const tExp     = useTranslations("dashboard.manager.expenses");
  const tExpCat  = useTranslations("dashboard.manager.expenses.categories");
  const tAge     = useTranslations("dashboard.manager.aging");
  const tTeam    = useTranslations("dashboard.manager.team");
  const tTeamTbl = useTranslations("dashboard.manager.team.table");
  const tAlerts  = useTranslations("dashboard.manager.alerts");
  const tRoles   = useTranslations("settings.roles");
  const locale   = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  const monthLabel = format(new Date(), "MMMM yyyy", { locale: dateFnsLocale });
  const omr      = useFormatCurrency();

  const [data, setData]       = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = propertyId ? `?propertyId=${propertyId}` : "";
      const res = await fetch(`/api/dashboard/manager${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
      setError(null);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">{t("loading")}</div>
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? t("noData")}
      </div>
    );

  const { kpis, revenueTrend, expenseBreakdown, aging, receptionistPerformance,
          buildingComparison, occupancyTrend, alerts } = data;

  const totalAging =
    aging.buckets.current + aging.buckets.d1to30 + aging.buckets.d31to60 +
    aging.buckets.d61to90 + aging.buckets.d90plus;

  return (
    <div className="space-y-6">
      {/* ── Alerts ── */}
      {!highlightsOnly && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.type}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${ALERT_STYLES[a.severity]}`}
            >
              <div className="flex items-center gap-2 text-sm">
                <span>{ALERT_ICONS[a.severity]}</span>
                {a.message}
              </div>
              {a.link && (
                <Link href={a.link} className="text-sm font-semibold shrink-0 hover:underline">
                  {tAlerts("view")}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── KPI cards ── */}
      {!highlightsOnly && (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label={tKpis("revenueMTD")}
          value={omr(kpis.revenueMTD)}
          trend={kpis.revenueTrend}
          sub={monthLabel}
          color="bg-green-100"
          icon={BanknotesIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("expensesMTD")}
          value={omr(kpis.expensesMTD)}
          trend={kpis.expensesTrend}
          inverseTrend
          sub={tKpis("lowerBetter")}
          color="bg-red-100"
          icon={ArrowTrendingDownIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("noi")}
          value={omr(kpis.noi)}
          trend={kpis.noiTrend}
          sub={tKpis("revenueMinusExpenses")}
          color={kpis.noi >= 0 ? "bg-emerald-100" : "bg-red-100"}
          icon={ArrowTrendingUpIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("occupancyRate")}
          value={`${kpis.occupancyRate}%`}
          trend={null}
          sub={tKpis("currentlyCheckedIn")}
          color="bg-blue-100"
          icon={HomeModernIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("outstanding")}
          value={omr(kpis.outstanding)}
          trend={null}
          sub={tKpis("outstandingSub", { count: kpis.outstandingCount })}
          color="bg-orange-100"
          icon={ExclamationTriangleIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("buildings")}
          value={String(buildingComparison.length)}
          trend={null}
          sub={tKpis("totalUnits", { count: buildingComparison.reduce((s, b) => s + b.totalUnits, 0) })}
          color="bg-purple-100"
          icon={BuildingOfficeIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
      </div>
      )}

      {/* ── Charts row ── */}
      {!highlightsOnly && (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            {tCharts("revenue30")}
          </h3>
          <MinimalLineChart data={revenueTrend} noDataLabel={tCharts("noData")} dateFnsLocale={dateFnsLocale} />
        </div>

        {/* Revenue by month (6 months) */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            {tCharts("revenue6m")}
          </h3>
          <MinimalBarChart data={occupancyTrend} noDataLabel={tCharts("noData")} />
        </div>
      </div>
      )}

      {/* ── Building comparison ── */}
      {buildingComparison.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              {tBP("title", { month: monthLabel })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  {(["building", "units", "occupied", "occupancy", "revenueMTD", "expensesMTD", "noi"] as const).map((k) => (
                    <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {tBPTbl(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {buildingComparison.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.totalUnits}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.occupied}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${
                        b.occupancyPct >= 70
                          ? "text-green-700"
                          : b.occupancyPct >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}>
                        {b.occupancyPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-700 ltr-numbers">{omr(b.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 ltr-numbers">{omr(b.expenses)}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span className={`ltr-numbers ${b.noi >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {omr(b.noi)}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">{tBP("total")}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {buildingComparison.reduce((s, b) => s + b.totalUnits, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {buildingComparison.reduce((s, b) => s + b.occupied, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{kpis.occupancyRate}%</td>
                  <td className="px-4 py-3 text-sm text-green-700 ltr-numbers">
                    {omr(buildingComparison.reduce((s, b) => s + b.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 ltr-numbers">
                    {omr(buildingComparison.reduce((s, b) => s + b.expenses, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-700 ltr-numbers">
                    {omr(buildingComparison.reduce((s, b) => s + b.noi, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Expenses + Aging ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Expense breakdown */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            {tExp("title", { month: monthLabel })}
          </h3>
          {expenseBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">{tExp("none")}</p>
          ) : (
            <div className="space-y-3">
              {expenseBreakdown.map((e) => (
                <div key={e.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">
                      {tExpCat.has(e.category) ? tExpCat(e.category) : e.category}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{e.pct}%</span>
                      <span className="font-semibold text-gray-900 w-32 text-end ltr-numbers">
                        {omr(e.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-red-400 transition-all"
                      style={{ width: `${e.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-100 pt-2 mt-2 text-sm font-semibold">
                <span className="text-gray-700">{tExp("total")}</span>
                <span className="text-red-600 ltr-numbers">
                  {omr(expenseBreakdown.reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Aging receivables */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {tAge("title")}
            </h3>
            <Link
              href="/dashboard/payments"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {tAge("viewAll")}
            </Link>
          </div>

          {totalAging < 0.001 ? (
            <p className="text-sm text-gray-400">{tAge("noBalances")}</p>
          ) : (
            <div className="space-y-3">
              {([
                ["current",  aging.buckets.current,  aging.counts.current,  "bg-blue-400",   false],
                ["d1to30",   aging.buckets.d1to30,   aging.counts.d1to30,   "bg-amber-400",  false],
                ["d31to60",  aging.buckets.d31to60,  aging.counts.d31to60,  "bg-orange-500", false],
                ["d61to90",  aging.buckets.d61to90,  aging.counts.d61to90,  "bg-red-400",    false],
                ["d90plus",  aging.buckets.d90plus,  aging.counts.d90plus,  "bg-red-700",    true],
              ] as ["current" | "d1to30" | "d31to60" | "d61to90" | "d90plus", number, number, string, boolean][]).map(
                ([key, amount, count, barColor, urgent]) => (
                  <div key={key} className={`rounded-lg p-3 ${urgent && amount > 0.001 ? "bg-red-50 ring-1 ring-red-200" : ""}`}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${barColor}`} />
                        <span className="font-medium text-gray-700">{tAge(key)}</span>
                        {count > 0 && (
                          <span className="text-xs text-gray-400">
                            {tAge("tenants", { count })}
                          </span>
                        )}
                        {urgent && amount > 0.001 && (
                          <span className="text-xs font-bold text-red-700">{tAge("urgent")}</span>
                        )}
                      </div>
                      <span className={`font-semibold ltr-numbers ${urgent && amount > 0.001 ? "text-red-700" : "text-gray-900"}`}>
                        {omr(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{
                          width: totalAging > 0
                            ? `${Math.min((amount / totalAging) * 100, 100)}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
                <span className="text-gray-700">{tAge("totalOutstanding")}</span>
                <span className="text-red-600 ltr-numbers">{omr(totalAging)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Receptionist performance ── */}
      {!highlightsOnly && receptionistPerformance.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <UserGroupIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              {tTeam("title", { month: monthLabel })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  {(["rank", "name", "role", "reservationsCreated", "checkins", "checkouts", "paymentsLogged", "totalActions"] as const).map((k) => (
                    <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {tTeamTbl(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receptionistPerformance.map((p, i) => (
                  <tr key={p.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-amber-100 text-amber-700"
                        : i === 1 ? "bg-gray-100 text-gray-600"
                        : "bg-gray-50 text-gray-400"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {tRoles.has(p.role) ? tRoles(p.role) : p.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.created}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.checkins}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.checkouts}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.payments}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
