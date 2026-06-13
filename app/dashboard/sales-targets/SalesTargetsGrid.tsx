"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveSalesTargets, type Scope, type PeriodType, type SavedTarget } from "./actions";

interface Entity { id: string; name: string; role?: string; group?: string }
interface Props {
  receptionists: Entity[];
  buildings: Entity[];
  units: Entity[];
  initialTargets: SavedTarget[];
}

const SCOPES: Scope[] = ["RECEPTIONIST", "BUILDING", "UNIT"];

function monthStart(month: string) {
  return `${month}-01`;
}
function mondayOf(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  const dow = d.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift))
    .toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function SalesTargetsGrid({ receptionists, buildings, units, initialTargets }: Props) {
  const t = useTranslations("salesTargets");

  const today = useMemo(() => new Date(), []);
  const defaultMonth = today.toISOString().slice(0, 7);
  const defaultDate = today.toISOString().slice(0, 10);

  const [targets, setTargets] = useState<SavedTarget[]>(initialTargets);
  const [scope, setScope] = useState<Scope>("RECEPTIONIST");
  const [periodType, setPeriodType] = useState<PeriodType>("MONTHLY");
  const [month, setMonth] = useState(defaultMonth);
  const [weekDate, setWeekDate] = useState(defaultDate);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const periodStart = periodType === "MONTHLY" ? monthStart(month) : mondayOf(weekDate);

  const entities = scope === "RECEPTIONIST" ? receptionists : scope === "BUILDING" ? buildings : units;

  // Rebuild the amount inputs whenever the scope/period (or saved targets) change.
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const tg of targets) {
      if (tg.scope === scope && tg.periodType === periodType && tg.periodStart === periodStart) {
        map[tg.refId] = tg.amount;
      }
    }
    setAmounts(map);
  }, [scope, periodType, periodStart, targets]);

  const total = entities.reduce((s, e) => {
    const n = Number(amounts[e.id]);
    return s + (isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const weekEnd = addDaysIso(periodStart, 6);
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  async function onSave() {
    setSaving(true);
    try {
      const entries = entities.map((e) => ({ refId: e.id, amount: amounts[e.id] ?? "" }));
      const res = await saveSalesTargets({ scope, periodType, periodStart, entries });
      if (!res.ok) {
        toast.error(res.error === "forbidden" ? t("errors.forbidden") : t("errors.generic"));
        return;
      }
      // Replace this scope+period slice with the saved set.
      setTargets((prev) => [
        ...prev.filter((p) => !(p.scope === scope && p.periodType === periodType && p.periodStart === periodStart)),
        ...res.targets,
      ]);
      toast.success(t("saved"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("scope")}</label>
          <div className="flex gap-2">
            {SCOPES.map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={tabCls(scope === s)}>
                {t(`scopes.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("periodType")}</label>
          <div className="flex gap-2">
            {(["MONTHLY", "WEEKLY"] as PeriodType[]).map((p) => (
              <button key={p} type="button" onClick={() => setPeriodType(p)} className={tabCls(periodType === p)}>
                {t(`periodTypes.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t("period")}</label>
          {periodType === "MONTHLY" ? (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ltr-numbers"
            />
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ltr-numbers"
              />
              <span className="text-xs text-gray-500 ltr-numbers">{fmtDay(periodStart)} – {fmtDay(weekEnd)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 ps-5 pe-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("entity")}</th>
              <th className="px-5 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500 w-56">{t("target")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entities.map((e) => (
              <tr key={e.id}>
                <td className="py-3 ps-5 pe-3">
                  <div className="text-sm font-medium text-gray-900">{e.name}</div>
                  {(e.role || e.group) && (
                    <div className="text-xs text-gray-400">{e.role ?? e.group}</div>
                  )}
                </td>
                <td className="px-5 py-2.5 text-end">
                  <div className="inline-flex items-center gap-1.5">
                    <input
                      inputMode="decimal"
                      value={amounts[e.id] ?? ""}
                      onChange={(ev) => setAmounts((m) => ({ ...m, [e.id]: ev.target.value }))}
                      placeholder="0.000"
                      className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">{t("omr")}</span>
                  </div>
                </td>
              </tr>
            ))}
            {entities.length === 0 && (
              <tr>
                <td colSpan={2} className="py-10 text-center text-sm text-gray-400">{t("empty")}</td>
              </tr>
            )}
          </tbody>
          {entities.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td className="py-3 ps-5 pe-3 text-sm font-semibold text-gray-700">{t("total")}</td>
                <td className="px-5 py-3 text-end text-sm font-bold text-gray-900 ltr-numbers">{total.toFixed(3)} {t("omr")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || entities.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
