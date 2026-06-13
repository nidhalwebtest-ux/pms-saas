"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getTargetVsActual, type Scope, type PeriodType, type PerfRow } from "./actions";

const SCOPES: Scope[] = ["RECEPTIONIST", "BUILDING", "UNIT"];

function monthStart(month: string) { return `${month}-01`; }
function mondayOf(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const dow = d.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift)).toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function SalesPerformance() {
  const t = useTranslations("salesTargets");
  const today = useMemo(() => new Date(), []);
  const [scope, setScope] = useState<Scope>("RECEPTIONIST");
  const [periodType, setPeriodType] = useState<PeriodType>("MONTHLY");
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [weekDate, setWeekDate] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [totals, setTotals] = useState({ target: 0, actual: 0 });
  const [loading, setLoading] = useState(false);

  const periodStart = periodType === "MONTHLY" ? monthStart(month) : mondayOf(weekDate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTargetVsActual({ scope, periodType, periodStart })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) { setRows(res.rows); setTotals({ target: res.totalTarget, actual: res.totalActual }); }
        else { setRows([]); setTotals({ target: 0, actual: 0 }); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, periodType, periodStart]);

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const achColor = (target: number, actual: number) => {
    if (target <= 0) return "text-gray-400";
    const pct = (actual / target) * 100;
    return pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600";
  };
  const barColor = (target: number, actual: number) => {
    if (target <= 0) return "bg-gray-300";
    const pct = (actual / target) * 100;
    return pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  };

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("scope")}</label>
          <div className="flex gap-2">
            {SCOPES.map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={tabCls(scope === s)}>{t(`scopes.${s}`)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("periodType")}</label>
          <div className="flex gap-2">
            {(["MONTHLY", "WEEKLY"] as PeriodType[]).map((p) => (
              <button key={p} type="button" onClick={() => setPeriodType(p)} className={tabCls(periodType === p)}>{t(`periodTypes.${p}`)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("period")}</label>
          {periodType === "MONTHLY" ? (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ltr-numbers" />
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ltr-numbers" />
              <span className="text-xs text-gray-500 ltr-numbers">{fmtDay(periodStart)} – {fmtDay(addDaysIso(periodStart, 6))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 ps-5 pe-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("entity")}</th>
              <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{t("report.target")}</th>
              <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{t("report.actual")}</th>
              <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500">{t("report.variance")}</th>
              <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 w-44">{t("report.achievement")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">{t("report.loading")}</td></tr>
            )}
            {!loading && rows.map((r) => {
              const variance = Math.round((r.actual - r.target) * 1000) / 1000;
              const pct = r.target > 0 ? (r.actual / r.target) * 100 : null;
              return (
                <tr key={r.refId}>
                  <td className="py-3 ps-5 pe-3 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-3 text-sm text-end text-gray-700 ltr-numbers">{r.target.toFixed(3)}</td>
                  <td className="px-3 py-3 text-sm text-end font-semibold text-gray-900 ltr-numbers">{r.actual.toFixed(3)}</td>
                  <td className={`px-3 py-3 text-sm text-end font-medium ltr-numbers ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {variance >= 0 ? "+" : ""}{variance.toFixed(3)}
                  </td>
                  <td className="px-5 py-3 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full ${barColor(r.target, r.actual)}`} style={{ width: `${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      <span className={`text-sm font-semibold ltr-numbers ${achColor(r.target, r.actual)}`}>
                        {pct === null ? "—" : `${Math.round(pct)}%`}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">{t("report.noData")}</td></tr>
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td className="py-3 ps-5 pe-3 text-sm font-semibold text-gray-700">{t("total")}</td>
                <td className="px-3 py-3 text-end text-sm font-bold text-gray-900 ltr-numbers">{totals.target.toFixed(3)}</td>
                <td className="px-3 py-3 text-end text-sm font-bold text-gray-900 ltr-numbers">{totals.actual.toFixed(3)}</td>
                <td className={`px-3 py-3 text-end text-sm font-bold ltr-numbers ${totals.actual - totals.target >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {totals.actual - totals.target >= 0 ? "+" : ""}{(totals.actual - totals.target).toFixed(3)}
                </td>
                <td className={`px-5 py-3 text-end text-sm font-bold ltr-numbers ${achColor(totals.target, totals.actual)}`}>
                  {totals.target > 0 ? `${Math.round((totals.actual / totals.target) * 100)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
