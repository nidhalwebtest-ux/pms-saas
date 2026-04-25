"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  HomeModernIcon,
  TagIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ListBulletIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { bulkCreateUnits } from "@/app/dashboard/units/actions";
import { useTranslations } from "next-intl";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  { value: "STUDIO",   bedrooms: 0, bathrooms: 1 },
  { value: "ONE_BR",   bedrooms: 1, bathrooms: 1 },
  { value: "TWO_BR",   bedrooms: 2, bathrooms: 1 },
  { value: "THREE_BR", bedrooms: 3, bathrooms: 2 },
  { value: "SUITE",    bedrooms: 2, bathrooms: 2 },
] as const;

type UnitTypeValue = (typeof UNIT_TYPES)[number]["value"];

interface UnitRow {
  name:      string;
  unitType:  UnitTypeValue;
  bedrooms:  number;
  bathrooms: number;
  area:      string;     // string in form state to allow blank input
  basePrice: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateNames(prefix: string, sep: string, start: number, end: number): string[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const count = end - start + 1;
  if (count > 200) return [];
  const names: string[] = [];
  for (let i = start; i <= end; i++) {
    names.push(prefix ? `${prefix}${sep}${i}` : String(i));
  }
  return names;
}

function defaultsForType(type: UnitTypeValue): { bedrooms: number; bathrooms: number } {
  const t = UNIT_TYPES.find((u) => u.value === type);
  return { bedrooms: t?.bedrooms ?? 1, bathrooms: t?.bathrooms ?? 1 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, badge, children,
}: {
  icon: React.ElementType; title: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Icon className="h-4 w-4 text-blue-500" />
        {title}
        {badge}
      </h3>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  properties:        { id: string; name: string }[];
  defaultPropertyId?: string;
}

export default function BulkCreateForm({ properties, defaultPropertyId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("units.bulk");
  const tTypes = useTranslations("units.types");

  // Property + floor
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? "");
  const [floor, setFloor]           = useState(1);

  // Defaults applied to newly generated rows. Editing these does NOT mutate
  // existing rows — only the next regenerate / addBlank uses them.
  const [defType,  setDefType]  = useState<UnitTypeValue>("ONE_BR");
  const [defArea,  setDefArea]  = useState("");
  const [defPrice, setDefPrice] = useState("");

  // Naming pattern
  const [prefix,    setPrefix]    = useState("Room");
  const [separator, setSeparator] = useState(" ");
  const [startNum,  setStartNum]  = useState(101);
  const [endNum,    setEndNum]    = useState(120);

  // Default unit-price snapshot (optional)
  const [createPrice,  setCreatePrice]  = useState(false);
  const [dailyRate,    setDailyRate]    = useState("");
  const [weeklyRate,   setWeeklyRate]   = useState("");
  const [monthlyRate,  setMonthlyRate]  = useState("");

  // Per-row data
  const [rows, setRows] = useState<UnitRow[]>([]);

  const generatedNames = useMemo(
    () => generateNames(prefix, separator, startNum, endNum),
    [prefix, separator, startNum, endNum],
  );

  const [hasCustomized, setHasCustomized] = useState(false);

  const seedRow = (name: string): UnitRow => {
    const { bedrooms, bathrooms } = defaultsForType(defType);
    return { name, unitType: defType, bedrooms, bathrooms, area: defArea, basePrice: defPrice };
  };

  // Re-seed rows from pattern unless the user hand-edited them.
  useEffect(() => {
    if (!hasCustomized) {
      setRows(generatedNames.map(seedRow));
    }
  }, [generatedNames, hasCustomized]); // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate() {
    setRows(generatedNames.map(seedRow));
    setHasCustomized(false);
  }

  function patchRow(i: number, patch: Partial<UnitRow>) {
    setHasCustomized(true);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function patchType(i: number, type: UnitTypeValue) {
    const { bedrooms, bathrooms } = defaultsForType(type);
    patchRow(i, { unitType: type, bedrooms, bathrooms });
  }

  function removeRow(i: number) {
    setHasCustomized(true);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addBlankRow() {
    setHasCustomized(true);
    setRows((prev) => [...prev, seedRow("")]);
  }

  const validCount = rows.filter((r) => r.name.trim() && parseFloat(r.basePrice) >= 0).length;
  const canSubmit  = validCount > 0 && propertyId && (!createPrice || (dailyRate && monthlyRate));

  const rangeError = startNum > endNum
    ? t("rangeErrorOrder")
    : endNum - startNum + 1 > 200
    ? t("rangeErrorMax")
    : null;

  function handleSubmit() {
    if (!canSubmit) return;

    const payloadUnits = rows
      .filter((r) => r.name.trim() && parseFloat(r.basePrice) >= 0)
      .map((r) => ({
        name:      r.name.trim(),
        unitType:  r.unitType,
        bedrooms:  r.bedrooms,
        bathrooms: r.bathrooms,
        area:      r.area ? parseFloat(r.area) : null,
        basePrice: parseFloat(r.basePrice),
      }));

    startTransition(async () => {
      const res = await bulkCreateUnits({
        propertyId,
        floor,
        units: payloadUnits,
        createDefaultPrice: createPrice,
        dailyRate:   createPrice && dailyRate   ? parseFloat(dailyRate)   : null,
        weeklyRate:  createPrice && weeklyRate  ? parseFloat(weeklyRate)  : null,
        monthlyRate: createPrice && monthlyRate ? parseFloat(monthlyRate) : null,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("unitsCreatedToast", { count: res.created ?? 0 }));
        router.push(propertyId
          ? `/dashboard/properties/${propertyId}`
          : "/dashboard/units");
      }
    });
  }

  const typeLabel = (v: UnitTypeValue) => {
    try { return tTypes(v as never); } catch { return v; }
  };

  return (
    <div className="space-y-5">

      {/* Property & Floor */}
      <Section icon={HomeModernIcon} title={t("propertyAndFloor")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("property")} <span className="text-red-500">*</span>
            </label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">{t("propertyPlaceholder")}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("floor")}</label>
            <input
              type="number"
              min="0"
              value={floor}
              onChange={(e) => setFloor(parseInt(e.target.value) || 0)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-gray-400">{t("floorHelp")}</p>
          </div>
        </div>
      </Section>

      {/* Naming pattern */}
      <Section
        icon={ListBulletIcon}
        title={t("namingPattern")}
        badge={<span className="ms-auto text-xs font-normal text-gray-400">{t("namingPatternHelp")}</span>}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("prefix")}</label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => { setPrefix(e.target.value); setHasCustomized(false); }}
              placeholder={t("prefixPlaceholder")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("startNum")}</label>
            <input
              type="number"
              value={startNum}
              onChange={(e) => { setStartNum(parseInt(e.target.value) || 1); setHasCustomized(false); }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ltr-numbers"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("endNum")}</label>
            <input
              type="number"
              value={endNum}
              onChange={(e) => { setEndNum(parseInt(e.target.value) || 1); setHasCustomized(false); }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ltr-numbers"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">{t("separator")}</p>
          <div className="flex gap-2">
            {[
              { value: " ", labelKey: "sepSpace" },
              { value: "",  labelKey: "sepNone"  },
              { value: "-", labelKey: "sepDash"  },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setSeparator(opt.value); setHasCustomized(false); }}
                className={`flex flex-col items-center rounded-lg border-2 px-3 py-2 text-xs transition-all ${
                  separator === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
                }`}
              >
                <span className="font-semibold">{t(opt.labelKey as never)}</span>
                <span className="mt-0.5 text-[10px] text-gray-400 ltr-numbers">{prefix ? `${prefix}${opt.value}101` : "101"}</span>
              </button>
            ))}
          </div>
        </div>

        {rangeError ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
            <XMarkIcon className="h-3.5 w-3.5" /> {rangeError}
          </p>
        ) : generatedNames.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
            <InformationCircleIcon className="h-3.5 w-3.5 text-blue-400" />
            {generatedNames.length > 1
              ? t.rich("willGenerateRange", {
                  count: generatedNames.length,
                  first: generatedNames[0],
                  last:  generatedNames[generatedNames.length - 1],
                  b:    (chunks) => <strong>{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-gray-700">{chunks}</span>,
                })
              : t.rich("willGenerateSingle", {
                  count: generatedNames.length,
                  first: generatedNames[0],
                  b:    (chunks) => <strong>{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-gray-700">{chunks}</span>,
                })}
          </p>
        )}
      </Section>

      {/* Defaults for newly generated rows */}
      <Section
        icon={TagIcon}
        title={t("defaultsTitle")}
        badge={<span className="ms-auto text-xs font-normal text-gray-400">{t("defaultsHelp")}</span>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("unitType")}</label>
            <select
              value={defType}
              onChange={(e) => setDefType(e.target.value as UnitTypeValue)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {UNIT_TYPES.map((u) => (
                <option key={u.value} value={u.value}>{typeLabel(u.value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("areaLabel")}</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={defArea}
              onChange={(e) => setDefArea(e.target.value)}
              placeholder={t("areaOptional")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("basePrice")} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={defPrice}
              onChange={(e) => setDefPrice(e.target.value)}
              placeholder={t("basePricePlaceholder")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </Section>

      {/* Default Pricing snapshot (optional) */}
      <Section icon={CurrencyDollarIcon} title={t("defaultPricing")}>
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={createPrice}
            onClick={() => setCreatePrice((v) => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              createPrice ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${createPrice ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <div>
            <p className="text-sm font-medium text-gray-700">{t("defaultPricingLabel")}</p>
            <p className="text-xs text-gray-400">{t("defaultPricingHelp")}</p>
          </div>
        </div>

        {createPrice && (
          <div className="grid grid-cols-3 gap-4 rounded-xl bg-blue-50 p-4">
            {[
              { labelKey: "dailyRateReq",   key: "daily",   value: dailyRate,   set: setDailyRate,   required: true  },
              { labelKey: "weeklyRate",     key: "weekly",  value: weeklyRate,  set: setWeeklyRate,  required: false },
              { labelKey: "monthlyRateReq", key: "monthly", value: monthlyRate, set: setMonthlyRate, required: true  },
            ].map(({ labelKey, key, value, set, required }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">{t(labelKey as never)}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">OMR</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={t("ratePlaceholder")}
                    required={required}
                    className="block w-full rounded-lg border border-blue-200 bg-white py-2 ps-12 pe-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Per-row editor */}
      <Section
        icon={ListBulletIcon}
        title={t("preview")}
        badge={
          <div className="ms-auto flex items-center gap-2">
            {validCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white ltr-numbers">
                {validCount}
              </span>
            )}
            <button
              type="button"
              onClick={regenerate}
              title={t("regenerateTitle")}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              {t("regenerate")}
            </button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <HomeModernIcon className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">{t("emptyPreviewTitle")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-start font-medium ps-6 pe-2 py-2">#</th>
                  <th className="text-start font-medium px-2 py-2">{t("colName")}</th>
                  <th className="text-start font-medium px-2 py-2">{t("colType")}</th>
                  <th className="text-center font-medium px-2 py-2">{t("colBeds")}</th>
                  <th className="text-center font-medium px-2 py-2">{t("colBaths")}</th>
                  <th className="text-start font-medium px-2 py-2">{t("colArea")}</th>
                  <th className="text-start font-medium px-2 py-2">{t("colPrice")}</th>
                  <th className="pe-6 ps-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/40 transition-colors">
                    <td className="ps-6 pe-2 py-2 text-[11px] text-gray-400 ltr-numbers">{i + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => patchRow(i, { name: e.target.value })}
                        placeholder={t("namePlaceholder")}
                        className="block w-32 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.unitType}
                        onChange={(e) => patchType(i, e.target.value as UnitTypeValue)}
                        className="block w-28 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                      >
                        {UNIT_TYPES.map((u) => (
                          <option key={u.value} value={u.value}>{typeLabel(u.value)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.bedrooms}
                        onChange={(e) => patchRow(i, { bedrooms: parseInt(e.target.value) || 0 })}
                        className="block w-14 rounded-md border border-gray-200 px-2 py-1 text-xs text-center text-gray-800 focus:border-blue-500 focus:outline-none ltr-numbers"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.bathrooms}
                        onChange={(e) => patchRow(i, { bathrooms: parseInt(e.target.value) || 0 })}
                        className="block w-14 rounded-md border border-gray-200 px-2 py-1 text-xs text-center text-gray-800 focus:border-blue-500 focus:outline-none ltr-numbers"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={row.area}
                        onChange={(e) => patchRow(i, { area: e.target.value })}
                        placeholder="—"
                        className="block w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none ltr-numbers"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.basePrice}
                        onChange={(e) => patchRow(i, { basePrice: e.target.value })}
                        placeholder="0.000"
                        className="block w-24 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none ltr-numbers"
                      />
                    </td>
                    <td className="ps-2 pe-6 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title={t("removeRow")}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={addBlankRow}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <PlusCircleIcon className="h-4 w-4" />
            {t("addBlank")}
          </button>
        </div>
      </Section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/dashboard/units"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("cancel")}
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-sm"
        >
          {isPending ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              {t("creating")}
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              {validCount > 0 ? t("createCount", { count: validCount }) : t("createCountZero")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
