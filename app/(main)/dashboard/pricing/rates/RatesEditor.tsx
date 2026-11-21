"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { UNIT_TYPES } from "@/lib/pricing-management";
import { saveDefaultRates } from "../actions";

type Row = { id: string; name: string; unitType: string; propertyId: string; hasDefault: boolean; daily: string; weekly: string; monthly: string };
type Field = "daily" | "weekly" | "monthly";

const cell = "w-full rounded-md border px-2 py-1.5 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function RatesEditor({ canEdit, buildings, units, initialBuilding }: { canEdit: boolean; buildings: { id: string; name: string }[]; units: Row[]; initialBuilding: string }) {
  const t = useTranslations("pricing.rates");
  const tType = useTranslations("units.typesLong");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [building, setBuilding] = useState(initialBuilding);
  const [type, setType] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<Record<Field, string>>>>({});
  const [bulk, setBulk] = useState({ daily: "", monthly: "" });

  const buildingName = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);
  const shown = units.filter((u) => (!building || u.propertyId === building) && (!type || u.unitType === type));
  const value = (u: Row, f: Field) => edits[u.id]?.[f] ?? u[f];
  const isChanged = (u: Row) => (["daily", "weekly", "monthly"] as Field[]).some((f) => edits[u.id]?.[f] !== undefined && edits[u.id]![f] !== u[f]);
  const changed = units.filter(isChanged);

  const setCell = (id: string, f: Field, val: string) => setEdits((e) => ({ ...e, [id]: { ...e[id], [f]: val } }));
  const applyBulk = () =>
    setEdits((e) => {
      const next = { ...e };
      for (const u of shown) {
        next[u.id] = { ...next[u.id], ...(bulk.daily.trim() ? { daily: bulk.daily.trim() } : {}), ...(bulk.monthly.trim() ? { monthly: bulk.monthly.trim() } : {}) };
      }
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveDefaultRates(changed.map((u) => ({ unitId: u.id, daily: value(u, "daily"), weekly: value(u, "weekly"), monthly: value(u, "monthly") })));
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("saved", { n: res.saved ?? 0 }));
      setEdits({});
      router.refresh();
    });

  const select = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-gray-600">
          {t("filterBuilding")}
          <select className={`${select} mt-1 block`} value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">{t("all")}</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          {t("filterType")}
          <select className={`${select} mt-1 block`} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t("all")}</option>
            {UNIT_TYPES.map((ty) => <option key={ty} value={ty}>{tType(ty)}</option>)}
          </select>
        </label>

        {canEdit && shown.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2">
            <span className="w-full text-xs font-semibold text-gray-600 sm:w-auto sm:self-center">{t("applyTitle")}</span>
            <input className={`${cell} w-24 border-gray-300`} placeholder={t("applyDaily")} inputMode="decimal" dir="ltr" value={bulk.daily} onChange={(e) => setBulk((b) => ({ ...b, daily: e.target.value }))} />
            <input className={`${cell} w-24 border-gray-300`} placeholder={t("applyMonthly")} inputMode="decimal" dir="ltr" value={bulk.monthly} onChange={(e) => setBulk((b) => ({ ...b, monthly: e.target.value }))} />
            <Button size="sm" variant="secondary" onClick={applyBulk} disabled={!bulk.daily.trim() && !bulk.monthly.trim()}>{t("apply")}</Button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("unit")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("building")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("type")}</th>
                <th className="w-32 px-2 py-3 text-start font-medium">{t("daily")}</th>
                <th className="w-32 px-2 py-3 text-start font-medium">{t("weekly")}</th>
                <th className="w-32 px-2 py-3 text-start font-medium">{t("monthly")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((u) => (
                <tr key={u.id} className={isChanged(u) ? "bg-amber-50/60" : ""}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    {!u.hasDefault && <p className="text-[11px] text-amber-700">{t("noDefault")}</p>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{buildingName.get(u.propertyId)}</td>
                  <td className="px-4 py-2 text-gray-600">{tType(u.unitType)}</td>
                  {(["daily", "weekly", "monthly"] as Field[]).map((f) => {
                    const dirty = edits[u.id]?.[f] !== undefined && edits[u.id]![f] !== u[f];
                    return (
                      <td key={f} className="px-2 py-2">
                        {canEdit ? (
                          <input
                            className={`${cell} ${dirty ? "border-amber-400 bg-white" : "border-gray-200"}`}
                            inputMode="decimal"
                            dir="ltr"
                            value={value(u, f)}
                            onChange={(e) => setCell(u.id, f, e.target.value)}
                            aria-label={`${u.name} ${t(f)}`}
                          />
                        ) : (
                          <span className="tabular-nums" dir="ltr">{u[f] || "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm text-gray-600">{t("changed", { n: changed.length })}</span>
          <Button variant="secondary" onClick={() => setEdits({})} disabled={changed.length === 0 || pending}>{t("reset")}</Button>
          <Button variant="primary" onClick={save} loading={pending} disabled={changed.length === 0}>{t("save")}</Button>
        </div>
      )}
    </div>
  );
}
