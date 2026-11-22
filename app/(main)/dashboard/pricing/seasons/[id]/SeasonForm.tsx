"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/form/TextField";
import { TextArea } from "@/components/ui/form/TextArea";
import { NumberField } from "@/components/ui/form/NumberField";
import { Toggle } from "@/components/ui/form/Toggle";
import { UNIT_TYPES, SEASON_COLORS } from "@/lib/pricing-management";
import { saveSeason } from "../../actions";

type Rate = { daily: string; weekly: string; monthly: string };
const EMPTY: Rate = { daily: "", weekly: "", monthly: "" };

export type SeasonFormInitial = {
  id?: string;
  name: string;
  nameAr: string;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  disallowMonthly: boolean;
  color: string;
  propertyIds: string[];
  excludedUnitIds: string[];
  typeRates: Record<string, Rate>;
  unitRates: Record<string, Rate>;
  minNights: number | null;
  weekendAdjustPct: number | null;
  /** website landing page (opt-in) */
  publicPage: boolean;
  descriptionEn: string;
  descriptionAr: string;
};

type UnitRow = { id: string; name: string; unitType: string; propertyId: string; defaultDaily: string };

const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
    <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const rateInput = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function SeasonForm({ title, initial, buildings, units }: { title: string; initial: SeasonFormInitial; buildings: { id: string; name: string }[]; units: UnitRow[] }) {
  const t = useTranslations("pricing.form");
  const tType = useTranslations("units.typesLong");
  const tSeasons = useTranslations("pricing.seasons");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);
  const set = <K extends keyof SeasonFormInitial>(k: K, val: SeasonFormInitial[K]) => setV((s) => ({ ...s, [k]: val }));

  const buildingName = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);
  const scopeUnits = useMemo(
    () => units.filter((u) => v.propertyIds.length === 0 || v.propertyIds.includes(u.propertyId)),
    [units, v.propertyIds],
  );
  const typesInScope = UNIT_TYPES.filter((ty) => scopeUnits.some((u) => u.unitType === ty) || v.typeRates[ty]?.daily);
  const typeRate = (ty: string) => v.typeRates[ty] ?? EMPTY;
  const unitRate = (id: string) => v.unitRates[id] ?? EMPTY;
  const isIncluded = (u: UnitRow) => !v.excludedUnitIds.includes(u.id) && (!!unitRate(u.id).daily || !!typeRate(u.unitType).daily);
  const includedCount = scopeUnits.filter(isIncluded).length;

  const setTypeRate = (ty: string, k: keyof Rate, val: string) => set("typeRates", { ...v.typeRates, [ty]: { ...typeRate(ty), [k]: val } });
  const setUnitRate = (id: string, val: string) => set("unitRates", { ...v.unitRates, [id]: { ...unitRate(id), daily: val } });
  const toggleUnit = (id: string, on: boolean) => set("excludedUnitIds", on ? v.excludedUnitIds.filter((x) => x !== id) : [...v.excludedUnitIds, id]);
  const toggleBuilding = (id: string) => set("propertyIds", v.propertyIds.includes(id) ? v.propertyIds.filter((x) => x !== id) : [...v.propertyIds, id]);

  const save = () =>
    start(async () => {
      const res = await saveSeason({
        ...v,
        typeRates: Object.entries(v.typeRates).filter(([, r]) => r.daily.trim()).map(([unitType, r]) => ({ unitType, ...r })),
        // only overrides for units still in scope
        unitRates: Object.entries(v.unitRates)
          .filter(([id, r]) => r.daily.trim() && scopeUnits.some((u) => u.id === id))
          .map(([unitId, r]) => ({ unitId, ...r })),
        excludedUnitIds: v.excludedUnitIds.filter((id) => scopeUnits.some((u) => u.id === id)),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(tSeasons("saved"));
      router.push("/dashboard/pricing/seasons");
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/dashboard/pricing/seasons" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600">
          <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" /> {t("back")}
        </Link>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{title}</h2>
      </div>

      <Card title={t("basics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("name")} value={v.name} onChange={(e) => set("name", e.target.value)} required />
          <TextField label={t("nameAr")} value={v.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" showOptional />
          <TextField label={t("start")} type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} required />
          <TextField label={t("end")} type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} required />
          <NumberField label={t("priority")} value={v.priority} min={0} max={1000} step={1} onValueChange={(n) => set("priority", n ?? 0)} helperText={t("priorityHint")} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">{t("color")}</p>
            <div className="flex flex-wrap gap-2">
              {SEASON_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={v.color === c}
                  onClick={() => set("color", c)}
                  className={`h-8 w-8 rounded-full ring-offset-2 ${v.color === c ? "ring-2 ring-gray-900" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Toggle label={t("active")} checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} />
          <Toggle label={t("noMonthly")} description={t("noMonthlyHint")} checked={v.disallowMonthly} onCheckedChange={(c) => set("disallowMonthly", c)} />
        </div>
      </Card>

      <Card title={t("buildings")}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("propertyIds", [])}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${v.propertyIds.length === 0 ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {t("allBuildings")}
          </button>
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBuilding(b.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${v.propertyIds.includes(b.id) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t("rates")} hint={t("ratesHint")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="pb-2 text-start font-medium">{t("unitType")}</th>
                <th className="pb-2 text-start font-medium">{t("daily")}</th>
                <th className="pb-2 text-start font-medium">{t("weekly")} <span className="font-normal">({t("optional")})</span></th>
                <th className="pb-2 text-start font-medium">{t("monthly")} <span className="font-normal">({t("optional")})</span></th>
              </tr>
            </thead>
            <tbody>
              {typesInScope.map((ty) => (
                <tr key={ty}>
                  <td className="py-1.5 pe-3 font-medium text-gray-800">{tType(ty)}</td>
                  {(["daily", "weekly", "monthly"] as const).map((k) => (
                    <td key={k} className="py-1.5 pe-3">
                      <input className={rateInput} inputMode="decimal" dir="ltr" value={typeRate(ty)[k]} onChange={(e) => setTypeRate(ty, k, e.target.value)} placeholder="0.000" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("unitsInSeason")} hint={t("unitsHint")}>
        <p className="mb-3 text-xs font-semibold text-gray-600">{t("unitsCount", { in: includedCount, total: scopeUnits.length })}</p>
        {scopeUnits.length === 0 ? (
          <p className="text-sm text-gray-500">{t("noUnits")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {scopeUnits.map((u) => {
              const typeDaily = typeRate(u.unitType).daily;
              const own = unitRate(u.id).daily;
              const excluded = v.excludedUnitIds.includes(u.id);
              const priced = !!own || !!typeDaily;
              return (
                <li key={u.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${!priced || excluded ? "bg-gray-50/60" : ""}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    checked={!excluded && priced}
                    disabled={!priced}
                    onChange={(e) => toggleUnit(u.id, e.target.checked)}
                    aria-label={u.name}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {buildingName.get(u.propertyId)} · {tType(u.unitType)} · {t("defaultRate", { rate: u.defaultDaily || "—" })}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    {t("override")}
                    <input
                      className={`${rateInput} w-28`}
                      inputMode="decimal"
                      dir="ltr"
                      value={own}
                      onChange={(e) => setUnitRate(u.id, e.target.value)}
                      placeholder={typeDaily || t("overridePlaceholder")}
                      disabled={excluded}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={t("rules")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t("minNights")}
            value={v.minNights}
            min={1}
            max={365}
            step={1}
            onValueChange={(n) => set("minNights", n === null ? null : Math.round(n))}
            helperText={t("minNightsHint")}
          />
          <NumberField
            label={t("weekendPct")}
            value={v.weekendAdjustPct}
            min={-90}
            max={500}
            step={1}
            onValueChange={(n) => set("weekendAdjustPct", n === null ? null : Math.round(n))}
            helperText={t("weekendPctHint")}
          />
        </div>
      </Card>

      <Card title={t("website")} hint={t("websiteHint")}>
        <Toggle label={t("publicPage")} description={t("publicPageHint")} checked={v.publicPage} onCheckedChange={(c) => set("publicPage", c)} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextArea label={t("descEn")} value={v.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} minRows={3} dir="ltr" maxLength={1500} showOptional />
          <TextArea label={t("descAr")} value={v.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} minRows={3} dir="rtl" maxLength={1500} showOptional />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.push("/dashboard/pricing/seasons")}>{t("cancel")}</Button>
        <Button variant="primary" onClick={save} loading={pending}>{t("save")}</Button>
      </div>
    </div>
  );
}
