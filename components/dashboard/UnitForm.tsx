"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUnit, updateUnit } from "@/app/dashboard/units/actions";
import { FormActions } from "@/components/ui/FormComponents";
import {
  HomeModernIcon,
  AdjustmentsHorizontalIcon,
  PhotoIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  TagIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import PhotoUpload from "@/components/dashboard/PhotoUpload";

// ── Unit types ────────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  { value: "STUDIO",    label: "Studio", sub: "0 bed",  bedrooms: 0, bathrooms: 1 },
  { value: "ONE_BR",    label: "1 BR",   sub: "1 bed",  bedrooms: 1, bathrooms: 1 },
  { value: "TWO_BR",    label: "2 BR",   sub: "2 bed",  bedrooms: 2, bathrooms: 1 },
  { value: "THREE_BR",  label: "3 BR",   sub: "3 bed",  bedrooms: 3, bathrooms: 2 },
  { value: "SUITE",     label: "Suite",  sub: "Luxury", bedrooms: 2, bathrooms: 2 },
] as const;

// ── Amenities ─────────────────────────────────────────────────────────────────

const AMENITIES = [
  { value: "AC",        label: "A/C" },
  { value: "FURNISHED", label: "Furnished" },
  { value: "KITCHEN",   label: "Kitchen" },
  { value: "PARKING",   label: "Parking" },
  { value: "WIFI",      label: "Wi-Fi" },
  { value: "TV",        label: "TV" },
  { value: "BALCONY",   label: "Balcony" },
  { value: "POOL",      label: "Pool" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  properties: { id: string; name: string }[];
  initialData?: {
    id: string;
    propertyId: string;
    name: string;
    basePrice: any;
    unitType: string;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    area: number | null;
    description: string | null;
    amenities: string[];
    status: string;
    photos: string[];
  } | null;
  defaultPropertyId?: string;
}

// ── Counter input ─────────────────────────────────────────────────────────────

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors leading-none"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold text-gray-800">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function UnitForm({ properties, initialData, defaultPropertyId }: Props) {
  const router      = useRouter();
  const [isPending, startTransition] = useTransition();

  const [status,    setStatus]    = useState<"AVAILABLE" | "MAINTENANCE">(
    (initialData?.status as any) ?? "AVAILABLE",
  );
  const [unitType,  setUnitType]  = useState(initialData?.unitType ?? "ONE_BR");
  const [bedrooms,  setBedrooms]  = useState(initialData?.bedrooms ?? 1);
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms ?? 1);
  const [amenities, setAmenities] = useState<Set<string>>(
    new Set(initialData?.amenities ?? []),
  );

  const isEditMode    = !!initialData;
  const storageFolder = `units/${initialData?.id ?? crypto.randomUUID()}`;

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("unitType",  unitType);
    fd.set("bedrooms",  String(bedrooms));
    fd.set("bathrooms", String(bathrooms));
    fd.set("amenities", JSON.stringify([...amenities]));

    startTransition(async () => {
      const result = isEditMode ? await updateUnit(fd) : await createUnit(fd);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditMode ? "Unit updated!" : "Unit created!");
      const propertyId = fd.get("propertyId") as string;
      setTimeout(() => {
        router.push(propertyId
          ? `/dashboard/properties/${propertyId}`
          : "/dashboard/units");
      }, 700);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}
      <input type="hidden" name="status" value={status} />

      {/* ── 1. Basic Info ────────────────────────────────────────────── */}
      <Section icon={HomeModernIcon} title="Unit Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">

          {/* Property */}
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              name="propertyId"
              required
              defaultValue={initialData?.propertyId || defaultPropertyId || ""}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Choose a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Unit name */}
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Unit Name / Number <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="e.g. Room 101, Apt 4B"
              defaultValue={initialData?.name}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Base price */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Base Price <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                OMR
              </span>
              <input
                name="basePrice"
                type="number"
                step="0.001"
                min="0"
                required
                placeholder="0.000"
                defaultValue={initialData ? Number(initialData.basePrice).toFixed(3) : ""}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-12 pr-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Floor */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Floor</label>
            <input
              name="floor"
              type="number"
              min="0"
              defaultValue={initialData?.floor ?? 1}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Area */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Area <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <input
                name="area"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 65"
                defaultValue={initialData?.area ?? ""}
                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-3 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                m²
              </span>
            </div>
          </div>

        </div>
      </Section>

      {/* ── 2. Unit Type ─────────────────────────────────────────────── */}
      <Section
        icon={TagIcon}
        title="Unit Type"
        badge={
          <span className="ml-auto text-xs font-normal text-gray-400">
            Selects type &amp; auto-fills beds/baths
          </span>
        }
      >
        {/* Type cards */}
        <div className="grid grid-cols-5 gap-2">
          {UNIT_TYPES.map((t) => {
            const active = unitType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeSelect(t)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3.5 text-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
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
                {active && (
                  <CheckCircleIcon className="mt-1.5 h-3.5 w-3.5 text-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bed / Bath counters */}
        <div className="mt-5 flex flex-wrap gap-8">
          <Counter label="Bedrooms"  value={bedrooms}  onChange={setBedrooms}  />
          <Counter label="Bathrooms" value={bathrooms} onChange={setBathrooms} />
        </div>
      </Section>

      {/* ── 3. Amenities + Description ───────────────────────────────── */}
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
        {/* Toggle pills */}
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
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {on && <CheckIcon className="h-3.5 w-3.5" />}
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Description */}
        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Description{" "}
            <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="e.g. Corner unit with sea view, recently renovated…"
            defaultValue={initialData?.description ?? ""}
            className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </Section>

      {/* ── 4. Availability Status ───────────────────────────────────── */}
      <Section icon={AdjustmentsHorizontalIcon} title="Availability Status">
        <div className="flex items-center gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={status === "AVAILABLE"}
            onClick={() => setStatus((s) => (s === "AVAILABLE" ? "MAINTENANCE" : "AVAILABLE"))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              status === "AVAILABLE" ? "bg-green-500" : "bg-amber-400"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                status === "AVAILABLE" ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            {status === "AVAILABLE" ? (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Available — can accept reservations
                </span>
              </>
            ) : (
              <>
                <WrenchScrewdriverIcon className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Under Maintenance — blocked for booking
                </span>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* ── 5. Photos ────────────────────────────────────────────────── */}
      <Section icon={PhotoIcon} title="Photos">
        <PhotoUpload
          initialPhotos={initialData?.photos ?? []}
          folder={storageFolder}
          name="photos"
        />
      </Section>

      <FormActions
        cancelHref={
          initialData?.propertyId
            ? `/dashboard/properties/${initialData.propertyId}`
            : "/dashboard/units"
        }
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Unit"}
      />
    </form>
  );
}
