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
} from "@heroicons/react/24/outline";
import { useFormatCurrency } from "@/lib/org-context";
import { SkeletonCard, SkeletonLine, SkeletonRectangle } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPIs {
  revenueMTD: number;    revenueTrend: number | null;
  expensesMTD: number;   expensesTrend: number | null;
  noi: number;           noiTrend: number | null;
  occupancyRate: number;
  outstanding: number;   outstandingCount: number;
}
interface RevPoint { date: string; revenue: number }
interface AgingBuckets {
  current: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number;
}
interface BuildingRow {
  id: string; name: string; totalUnits: number; occupied: number;
  occupancyPct: number; revenue: number; expenses: number; noi: number;
}
interface OccTrendPoint { month: string; revenue: number }
interface Alert {
  type: string; severity: "red" | "amber" | "blue"; message: string; link?: string;
}
interface KpiData {
  kpis: KPIs;
  revenueTrend: RevPoint[];
  aging: { buckets: AgingBuckets };
  buildingComparison: BuildingRow[];
  occupancyTrend: OccTrendPoint[];
  alerts: Alert[];
}

// ── Inline SVG charts (no external dependencies) ──────────────────────────────
// Single brand hue per chart (magnitude-only data) — see dataviz guidance.

const SVG_W = 600;
const SVG_H = 200;
const PAD = { l: 56, r: 8, t: 8, b: 28 };
const PLOT_W = SVG_W - PAD.l - PAD.r;
const PLOT_H = SVG_H - PAD.t - PAD.b;
const CHART_HUE = "#185FA5";

function MinimalLineChart({ data, noDataLabel, dateFnsLocale }: { data: RevPoint[]; noDataLabel: string; dateFnsLocale: Locale }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; val: string } | null>(null);
  const omr = useFormatCurrency();

  if (data.length === 0)
    return <div className="flex items-center justify-center h-[200px] text-sm text-fg-tertiary">{noDataLabel}</div>;

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
        <path d={pathD} fill="none" stroke={CHART_HUE} strokeWidth={2} strokeLinejoin="round" />
        {data.map((pt, i) => (
          <circle
            key={i}
            cx={xPx(i)}
            cy={yPx(pt.revenue)}
            r={4}
            fill="white"
            stroke={CHART_HUE}
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
    return <div className="flex items-center justify-center h-[200px] text-sm text-fg-tertiary">{noDataLabel}</div>;

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
              fill={CHART_HUE}
              className="cursor-pointer hover:opacity-80 transition-opacity"
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
        positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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
    <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-gray-900/5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-fg-tertiary">{label}</p>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-fg-primary truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-fg-tertiary">{sub}</p>}
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

function KpiSkeleton() {
  return (
    <SkeletonCard padding={0} bordered={false} announce className="bg-transparent">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} padding={20} bordered={false} announce={false} className="bg-subtle">
              <SkeletonLine width="60%" size="sm" />
              <SkeletonRectangle width="40%" height={28} className="mt-3" />
              <SkeletonLine width="55%" size="sm" className="mt-3" />
            </SkeletonCard>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} padding={20} announce={false}>
              <SkeletonLine width={160} size="sm" />
              <SkeletonRectangle width="100%" height={200} className="mt-4" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DashboardKPIs({ propertyId }: { propertyId: string }) {
  const t       = useTranslations("dashboard.manager");
  const tKpis   = useTranslations("dashboard.manager.kpis");
  const tTrend  = useTranslations("dashboard.manager.trend");
  const tCharts = useTranslations("dashboard.manager.charts");
  const tBP     = useTranslations("dashboard.manager.buildingPerf");
  const tBPTbl  = useTranslations("dashboard.manager.buildingPerf.table");
  const tAge    = useTranslations("dashboard.manager.aging");
  const tAlerts = useTranslations("dashboard.manager.alerts");
  const locale  = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;
  const monthLabel = format(new Date(), "MMMM yyyy", { locale: dateFnsLocale });
  const omr     = useFormatCurrency();

  const [data, setData]       = useState<KpiData | null>(null);
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

  if (loading) return <KpiSkeleton />;
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? t("noData")}
      </div>
    );

  const { kpis, revenueTrend, aging, buildingComparison, occupancyTrend, alerts } = data;
  const totalAging =
    aging.buckets.current + aging.buckets.d1to30 + aging.buckets.d31to60 +
    aging.buckets.d61to90 + aging.buckets.d90plus;

  return (
    <div className="space-y-5">
      {/* ── Alerts ── */}
      {alerts.length > 0 && (
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

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label={tKpis("revenueMTD")}
          value={omr(kpis.revenueMTD)}
          trend={kpis.revenueTrend}
          sub={monthLabel}
          color="bg-green-100 text-green-700"
          icon={BanknotesIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("expensesMTD")}
          value={omr(kpis.expensesMTD)}
          trend={kpis.expensesTrend}
          inverseTrend
          sub={tKpis("lowerBetter")}
          color="bg-red-100 text-red-700"
          icon={ArrowTrendingDownIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("noi")}
          value={omr(kpis.noi)}
          trend={kpis.noiTrend}
          sub={tKpis("revenueMinusExpenses")}
          color={kpis.noi >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
          icon={ArrowTrendingUpIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("occupancyRate")}
          value={`${kpis.occupancyRate}%`}
          trend={null}
          sub={tKpis("currentlyCheckedIn")}
          color="bg-blue-100 text-blue-700"
          icon={HomeModernIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
        <KpiCard
          label={tKpis("outstanding")}
          value={omr(kpis.outstanding)}
          trend={null}
          sub={tKpis("outstandingSub", { count: kpis.outstandingCount })}
          color="bg-orange-100 text-orange-700"
          icon={ExclamationTriangleIcon}
          vsLastMonthLabel={tTrend("vsLastMonth")}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-fg-primary">
            {tCharts("revenue30")}
          </h3>
          <MinimalLineChart data={revenueTrend} noDataLabel={tCharts("noData")} dateFnsLocale={dateFnsLocale} />
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-fg-primary">
            {tCharts("revenue6m")}
          </h3>
          <MinimalBarChart data={occupancyTrend} noDataLabel={tCharts("noData")} />
        </div>
      </div>

      {/* ── Aging receivables — compact strip (replaces the old full table) ── */}
      {totalAging > 0.001 && (
        <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-fg-primary">{tAge("title")}</h3>
            <Link href="/dashboard/payments" className="text-xs font-medium text-blue-600 hover:text-blue-800">
              {tAge("viewAll")}
            </Link>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            {([
              ["current", aging.buckets.current, "bg-blue-400"],
              ["d1to30", aging.buckets.d1to30, "bg-amber-400"],
              ["d31to60", aging.buckets.d31to60, "bg-orange-500"],
              ["d61to90", aging.buckets.d61to90, "bg-red-400"],
              ["d90plus", aging.buckets.d90plus, "bg-red-700"],
            ] as const).map(([key, amount, barColor]) =>
              amount > 0.001 ? (
                <div
                  key={key}
                  className={barColor}
                  style={{ width: `${(amount / totalAging) * 100}%` }}
                  title={`${tAge(key)}: ${omr(amount)}`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {([
              ["current", aging.buckets.current, "bg-blue-400"],
              ["d1to30", aging.buckets.d1to30, "bg-amber-400"],
              ["d31to60", aging.buckets.d31to60, "bg-orange-500"],
              ["d61to90", aging.buckets.d61to90, "bg-red-400"],
              ["d90plus", aging.buckets.d90plus, "bg-red-700"],
            ] as const).map(([key, amount, barColor]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className={`h-2 w-2 rounded-full ${barColor}`} />
                <span className="text-fg-tertiary">{tAge(key)}</span>
                <span className="font-semibold text-fg-primary ltr-numbers">{omr(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Building comparison ── */}
      {buildingComparison.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3">
            <BuildingOfficeIcon className="h-4 w-4 text-fg-tertiary" />
            <h3 className="text-sm font-semibold text-fg-primary">
              {tBP("title", { month: monthLabel })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle">
              <thead>
                <tr className="bg-subtle">
                  {(["building", "units", "occupied", "occupancy", "revenueMTD", "expensesMTD", "noi"] as const).map((k) => (
                    <th key={k} className="px-4 py-2.5 text-start text-xs font-semibold text-fg-tertiary uppercase tracking-wider whitespace-nowrap">
                      {tBPTbl(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {buildingComparison.map((b) => (
                  <tr key={b.id} className="hover:bg-subtle transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-fg-primary">{b.name}</td>
                    <td className="px-4 py-3 text-sm text-fg-secondary">{b.totalUnits}</td>
                    <td className="px-4 py-3 text-sm text-fg-secondary">{b.occupied}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${
                        b.occupancyPct >= 70 ? "text-green-700" : b.occupancyPct >= 50 ? "text-amber-600" : "text-red-600"
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
                <tr className="bg-subtle font-semibold">
                  <td className="px-4 py-3 text-sm text-fg-primary">{tBP("total")}</td>
                  <td className="px-4 py-3 text-sm text-fg-secondary">
                    {buildingComparison.reduce((s, b) => s + b.totalUnits, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-fg-secondary">
                    {buildingComparison.reduce((s, b) => s + b.occupied, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-fg-secondary">{kpis.occupancyRate}%</td>
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
    </div>
  );
}
