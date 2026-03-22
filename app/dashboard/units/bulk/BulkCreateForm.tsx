"use client";

import { useState, useTransition, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  HomeModernIcon,
  TagIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  CheckIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ListBulletIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { bulkCreateUnits } from "@/app/dashboard/units/actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  { value: "STUDIO",   label: "Studio", sub: "0 bed",  bedrooms: 0, bathrooms: 1 },
  { value: "ONE_BR",   label: "1 BR",   sub: "1 bed",  bedrooms: 1, bathrooms: 1 },
  { value: "TWO_BR",   label: "2 BR",   sub: "2 bed",  bedrooms: 2, bathrooms: 1 },
  { value: "THREE_BR", label: "3 BR",   sub: "3 bed",  bedrooms: 3, bathrooms: 2 },
  { value: "SUITE",    label: "Suite",  sub: "Luxury", bedrooms: 2, bathrooms: 2 },
] as const;

const AMENITIES = [
  { value: "AC",        label: "A/C"       },
  { value: "FURNISHED", label: "Furnished" },
  { value: "KITCHEN",   label: "Kitchen"   },
  { value: "PARKING",   label: "Parking"   },
  { value: "WIFI",      label: "Wi-Fi"     },
  { value: "TV",        label: "TV"        },
  { value: "BALCONY",   label: "Balcony"   },
  { value: "POOL",      label: "Pool"      },
];

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

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
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

function Counter({
  label, value, onChange, min = 0,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors leading-none"
        >−</button>
        <span className="w-6 text-center text-sm font-bold text-gray-800">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors leading-none"
        >+</button>
      </div>
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

  // Config state
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? "");
  const [floor,      setFloor]      = useState(1);
  const [unitType,   setUnitType]   = useState("ONE_BR");
  const [bedrooms,   setBedrooms]   = useState(1);
  const [bathrooms,  setBathrooms]  = useState(1);
  const [area,       setArea]       = useState("");
  const [basePrice,  setBasePrice]  = useState("");
  const [amenities,  setAmenities]  = useState<Set<string>>(new Set());

  // Naming pattern
  const [prefix,    setPrefix]    = useState("Room");
  const [separator, setSeparator] = useState(" ");   // " " or ""
  const [startNum,  setStartNum]  = useState(101);
  const [endNum,    setEndNum]    = useState(120);

  // Default pricing
  const [createPrice,  setCreatePrice]  = useState(false);
  const [dailyRate,    setDailyRate]    = useState("");
  const [weeklyRate,   setWeeklyRate]   = useState("");
  const [monthlyRate,  setMonthlyRate]  = useState("");

  // Editable preview list
  const [previewNames, setPreviewNames] = useState<string[]>([]);

  // Generate preview names whenever pattern changes
  const generatedNames = useMemo(
    () => generateNames(prefix, separator, startNum, endNum),
    [prefix, separator, startNum, endNum],
  );

  // Re-generate preview when pattern changes (but don't overwrite user edits unless they click Regenerate)
  const [hasCustomized, setHasCustomized] = useState(false);

  useEffect(() => {
    if (!hasCustomized) {
      setPreviewNames(generatedNames);
    }
  }, [generatedNames, hasCustomized]);

  function regenerate() {
    setPreviewNames(generatedNames);
    setHasCustomized(false);
  }

  function removeUnit(index: number) {
    setHasCustomized(true);
    setPreviewNames((prev) => prev.filter((_, i) => i !== index));
  }

  function updateName(index: number, value: string) {
    setHasCustomized(true);
    setPreviewNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addBlankUnit() {
    setHasCustomized(true);
    setPreviewNames((prev) => [...prev, ""]);
  }

  const handleTypeSelect = (t: (typeof UNIT_TYPES)[number]) => {
    setUnitType(t.value);
    setBedrooms(t.bedrooms);
    setBathrooms(t.bathrooms);
  };

  const toggleAmenity = (v: string) => {
    setAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const activeCount = previewNames.filter((n) => n.trim()).length;
  const canSubmit   = activeCount > 0 && propertyId && basePrice && (!createPrice || (dailyRate && monthlyRate));

  const rangeError = startNum > endNum
    ? "Start must be ≤ End"
    : endNum - startNum + 1 > 200
    ? "Max 200 units per batch"
    : null;

  function handleSubmit() {
    if (!canSubmit) return;
    const bp = parseFloat(basePrice);
    if (isNaN(bp) || bp < 0) { toast.error("Enter a valid base price."); return; }

    startTransition(async () => {
      const res = await bulkCreateUnits({
        propertyId,
        unitNames:          previewNames.filter((n) => n.trim()),
        unitType,
        floor,
        bedrooms,
        bathrooms,
        area:               area ? parseFloat(area) : null,
        basePrice:          bp,
        amenities:          [...amenities],
        createDefaultPrice: createPrice,
        dailyRate:          createPrice && dailyRate   ? parseFloat(dailyRate)   : null,
        weeklyRate:         createPrice && weeklyRate  ? parseFloat(weeklyRate)  : null,
        monthlyRate:        createPrice && monthlyRate ? parseFloat(monthlyRate) : null,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${res.created} unit${res.created !== 1 ? "s" : ""} created!`);
        router.push(propertyId
          ? `/dashboard/properties/${propertyId}`
          : "/dashboard/units");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

      {/* ── Left: Config ─────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Property & Floor */}
        <Section icon={HomeModernIcon} title="Property & Floor">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Property <span className="text-red-500">*</span>
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Choose a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Floor</label>
              <input
                type="number"
                min="0"
                value={floor}
                onChange={(e) => setFloor(parseInt(e.target.value) || 0)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-gray-400">0 = Ground floor</p>
            </div>
          </div>
        </Section>

        {/* Naming Pattern */}
        <Section
          icon={ListBulletIcon}
          title="Naming Pattern"
          badge={
            <span className="ml-auto text-xs font-normal text-gray-400">
              Generates unit names automatically
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setHasCustomized(false); }}
                placeholder="Room, Unit, Apt…"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Start #</label>
              <input
                type="number"
                value={startNum}
                onChange={(e) => { setStartNum(parseInt(e.target.value) || 1); setHasCustomized(false); }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">End #</label>
              <input
                type="number"
                value={endNum}
                onChange={(e) => { setEndNum(parseInt(e.target.value) || 1); setHasCustomized(false); }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Separator between prefix and number</p>
            <div className="flex gap-2">
              {[
                { value: " ",  label: "Space",   example: "Room 101" },
                { value: "",   label: "None",    example: "Room101"  },
                { value: "-",  label: "Dash",    example: "Room-101" },
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
                  <span className="font-semibold">{opt.label}</span>
                  <span className="mt-0.5 text-[10px] text-gray-400">{prefix ? `${prefix}${opt.value}101` : "101"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Range info */}
          {rangeError ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
              <XMarkIcon className="h-3.5 w-3.5" /> {rangeError}
            </p>
          ) : generatedNames.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
              <InformationCircleIcon className="h-3.5 w-3.5 text-blue-400" />
              Will generate <strong>{generatedNames.length}</strong> units:{" "}
              <span className="font-mono text-gray-700">
                {generatedNames[0]}
              </span>
              {generatedNames.length > 1 && (
                <> … <span className="font-mono text-gray-700">{generatedNames[generatedNames.length - 1]}</span></>
              )}
            </p>
          )}
        </Section>

        {/* Unit Type */}
        <Section
          icon={TagIcon}
          title="Unit Type"
          badge={
            <span className="ml-auto text-xs font-normal text-gray-400">
              Applied to all units in this batch
            </span>
          }
        >
          <div className="grid grid-cols-5 gap-2">
            {UNIT_TYPES.map((t) => {
              const active = unitType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeSelect(t)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3.5 text-center transition-all focus:outline-none ${
                    active
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <span className={`text-sm font-bold leading-none ${active ? "text-blue-600" : "text-gray-700"}`}>
                    {t.label}
                  </span>
                  <span className={`mt-1 text-[11px] leading-none ${active ? "text-blue-400" : "text-gray-400"}`}>
                    {t.sub}
                  </span>
                  {active && <CheckCircleIcon className="mt-1.5 h-3.5 w-3.5 text-blue-500" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Counter label="Bedrooms"  value={bedrooms}  onChange={setBedrooms}  />
            <Counter label="Bathrooms" value={bathrooms} onChange={setBathrooms} />
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">Area (m²)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="optional"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-500">
                Base Price (OMR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="0.000"
                required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Default Pricing */}
        <Section icon={CurrencyDollarIcon} title="Default Pricing">
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
              <p className="text-sm font-medium text-gray-700">Also create default pricing for all units</p>
              <p className="text-xs text-gray-400">Set daily + monthly rates applied to every unit in this batch</p>
            </div>
          </div>

          {createPrice && (
            <div className="grid grid-cols-3 gap-4 rounded-xl bg-blue-50 p-4">
              {[
                { label: "Daily Rate *",   key: "daily",   value: dailyRate,   set: setDailyRate,   required: true  },
                { label: "Weekly Rate",    key: "weekly",  value: weeklyRate,  set: setWeeklyRate,  required: false },
                { label: "Monthly Rate *", key: "monthly", value: monthlyRate, set: setMonthlyRate, required: true  },
              ].map(({ label, key, value, set, required }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">OMR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder="0.000"
                      required={required}
                      className="block w-full rounded-lg border border-blue-200 bg-white py-2 pl-12 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Amenities */}
        <Section
          icon={SparklesIcon}
          title="Amenities"
          badge={
            amenities.size > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {amenities.size}
              </span>
            ) : null
          }
        >
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const on = amenities.has(a.value);
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => toggleAmenity(a.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    on
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {on && <CheckIcon className="h-3.5 w-3.5" />}
                  {a.label}
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ── Right: Live Preview ──────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Preview
                {activeCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">Edit names or remove units before creating</p>
            </div>
            <button
              type="button"
              onClick={regenerate}
              title="Regenerate from pattern"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>

          {/* Name list */}
          <div className="max-h-[420px] overflow-y-auto p-3">
            {previewNames.length === 0 ? (
              <div className="py-10 text-center">
                <HomeModernIcon className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">Set a naming pattern to preview units</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {previewNames.map((name, i) => (
                  <div key={i} className="group flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
                    <span className="shrink-0 w-5 text-[10px] font-medium text-gray-400 text-right">{i + 1}.</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateName(i, e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-xs font-medium text-gray-800 focus:outline-none"
                      placeholder="Unit name…"
                    />
                    <button
                      type="button"
                      onClick={() => removeUnit(i)}
                      className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300 hover:text-red-400 transition-all"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <button
              type="button"
              onClick={addBlankUnit}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Add blank unit
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-sm"
            >
              {isPending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Create {activeCount > 0 ? activeCount : ""} Unit{activeCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
            <Link
              href="/dashboard/units"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
