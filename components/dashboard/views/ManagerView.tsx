"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

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

function MinimalLineChart({ data }: { data: RevPoint[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; val: string } | null>(null);

  if (data.length === 0)
    return <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No data</div>;

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
            {format(parseISO(data[i].date), "d MMM")}
          </text>
        ))}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        {data.map((pt, i) => (
          <circle
            key={i}
            cx={xPx(i)}
            cy={yPx(pt.revenue)}
            r={4}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            className="cursor-pointer opacity-0 hover:opacity-100"
            onMouseEnter={() =>
              setTip({
                x: xPx(i),
                y: yPx(pt.revenue),
                label: format(parseISO(pt.date), "d MMM yyyy"),
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

function MinimalBarChart({ data }: { data: OccTrendPoint[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; val: string } | null>(null);

  if (data.length === 0)
    return <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No data</div>;

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
              fill="#6366f1"
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

function omr(n: number) { return `${n.toFixed(3)} OMR`; }

const EXP_CAT_LABELS: Record<string, string> = {
  UTILITIES: "Utilities", MAINTENANCE: "Maintenance", SALARY: "Salary",
  MARKETING: "Marketing", SUPPLIES: "Supplies", OTHER: "Other",
};

function TrendBadge({
  value, inverse = false,
}: { value: number | null; inverse?: boolean }) {
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
      {pctStr} vs last month
    </span>
  );
}

function KpiCard({
  label, value, trend, inverseTrend = false, sub, color, icon: Icon,
}: {
  label: string; value: string; trend: number | null; inverseTrend?: boolean;
  sub?: string; color: string; icon: React.ElementType;
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
          <TrendBadge value={trend} inverse={inverseTrend} />
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

export function ManagerView({ propertyId }: { propertyId: string }) {
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
      setError("Failed to load manager data");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading manager data…</div>
      </div>
    );
  if (error || !data)
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? "No data"}
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
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label="Revenue (MTD)"
          value={omr(kpis.revenueMTD)}
          trend={kpis.revenueTrend}
          sub={format(new Date(), "MMMM yyyy")}
          color="bg-green-100"
          icon={BanknotesIcon}
        />
        <KpiCard
          label="Expenses (MTD)"
          value={omr(kpis.expensesMTD)}
          trend={kpis.expensesTrend}
          inverseTrend
          sub="lower is better"
          color="bg-red-100"
          icon={ArrowTrendingDownIcon}
        />
        <KpiCard
          label="Net Income (MTD)"
          value={omr(kpis.noi)}
          trend={kpis.noiTrend}
          sub="Revenue – Expenses"
          color={kpis.noi >= 0 ? "bg-emerald-100" : "bg-red-100"}
          icon={ArrowTrendingUpIcon}
        />
        <KpiCard
          label="Occupancy Rate"
          value={`${kpis.occupancyRate}%`}
          trend={null}
          sub="currently checked in"
          color="bg-blue-100"
          icon={HomeModernIcon}
        />
        <KpiCard
          label="Outstanding Balances"
          value={omr(kpis.outstanding)}
          trend={null}
          sub={`${kpis.outstandingCount} reservation${kpis.outstandingCount !== 1 ? "s" : ""}`}
          color="bg-orange-100"
          icon={ExclamationTriangleIcon}
        />
        <KpiCard
          label="Buildings"
          value={String(buildingComparison.length)}
          trend={null}
          sub={`${buildingComparison.reduce((s, b) => s + b.totalUnits, 0)} total units`}
          color="bg-purple-100"
          icon={BuildingOfficeIcon}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Revenue Trend — Last 30 Days
          </h3>
          <MinimalLineChart data={revenueTrend} />
        </div>

        {/* Revenue by month (6 months) */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Revenue — Last 6 Months
          </h3>
          <MinimalBarChart data={occupancyTrend} />
        </div>
      </div>

      {/* ── Building comparison ── */}
      {buildingComparison.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Building Performance — {format(new Date(), "MMMM yyyy")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  {["Building", "Units", "Occupied", "Occupancy", "Revenue (MTD)", "Expenses (MTD)", "NOI"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
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
                    <td className="px-4 py-3 text-sm font-semibold text-green-700">{omr(b.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{omr(b.expenses)}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span className={b.noi >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {omr(b.noi)}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {buildingComparison.reduce((s, b) => s + b.totalUnits, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {buildingComparison.reduce((s, b) => s + b.occupied, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{kpis.occupancyRate}%</td>
                  <td className="px-4 py-3 text-sm text-green-700">
                    {omr(buildingComparison.reduce((s, b) => s + b.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600">
                    {omr(buildingComparison.reduce((s, b) => s + b.expenses, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-700">
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
            Expense Breakdown — {format(new Date(), "MMMM yyyy")}
          </h3>
          {expenseBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses this month</p>
          ) : (
            <div className="space-y-3">
              {expenseBreakdown.map((e) => (
                <div key={e.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">
                      {EXP_CAT_LABELS[e.category] ?? e.category}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{e.pct}%</span>
                      <span className="font-semibold text-gray-900 w-32 text-right">
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
                <span className="text-gray-700">Total</span>
                <span className="text-red-600">
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
              Aging Receivables
            </h3>
            <Link
              href="/dashboard/payments"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View all →
            </Link>
          </div>

          {totalAging < 0.001 ? (
            <p className="text-sm text-gray-400">No outstanding balances</p>
          ) : (
            <div className="space-y-3">
              {([
                ["Current",   "current",  aging.buckets.current,  aging.counts.current,  "bg-blue-400",   false],
                ["1–30 days", "d1to30",   aging.buckets.d1to30,   aging.counts.d1to30,   "bg-amber-400",  false],
                ["31–60 days","d31to60",  aging.buckets.d31to60,  aging.counts.d31to60,  "bg-orange-500", false],
                ["61–90 days","d61to90",  aging.buckets.d61to90,  aging.counts.d61to90,  "bg-red-400",    false],
                ["90+ days",  "d90plus",  aging.buckets.d90plus,  aging.counts.d90plus,  "bg-red-700",    true],
              ] as [string, string, number, number, string, boolean][]).map(
                ([label, , amount, count, barColor, urgent]) => (
                  <div key={label} className={`rounded-lg p-3 ${urgent && amount > 0.001 ? "bg-red-50 ring-1 ring-red-200" : ""}`}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${barColor}`} />
                        <span className="font-medium text-gray-700">{label}</span>
                        {count > 0 && (
                          <span className="text-xs text-gray-400">
                            {count} tenant{count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {urgent && amount > 0.001 && (
                          <span className="text-xs font-bold text-red-700">⚠ URGENT</span>
                        )}
                      </div>
                      <span className={`font-semibold ${urgent && amount > 0.001 ? "text-red-700" : "text-gray-900"}`}>
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
                <span className="text-gray-700">Total Outstanding</span>
                <span className="text-red-600">{omr(totalAging)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Receptionist performance ── */}
      {receptionistPerformance.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <UserGroupIcon className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Team Performance — {format(new Date(), "MMMM yyyy")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  {["#", "Name", "Role", "Reservations Created", "Check-ins", "Check-outs", "Payments Logged", "Total Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
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
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                        {p.role.toLowerCase()}
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
