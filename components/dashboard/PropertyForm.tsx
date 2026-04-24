"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createProperty, updateProperty } from "@/app/dashboard/properties/actions";
import {
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  HomeModernIcon,
  SparklesIcon,
  MapPinIcon,
  PhotoIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import PhotoUpload from "@/components/dashboard/PhotoUpload";

// ── Type config ──────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  {
    value: "RESIDENTIAL",
    icon: HomeModernIcon,
    activeClasses: "border-blue-500 bg-blue-50 ring-2 ring-blue-500",
    iconClasses: "bg-blue-100 text-blue-600",
    labelClasses: "text-blue-700",
  },
  {
    value: "MIXED",
    icon: BuildingOffice2Icon,
    activeClasses: "border-violet-500 bg-violet-50 ring-2 ring-violet-500",
    iconClasses: "bg-violet-100 text-violet-600",
    labelClasses: "text-violet-700",
  },
  {
    value: "HOTEL",
    icon: SparklesIcon,
    activeClasses: "border-amber-500 bg-amber-50 ring-2 ring-amber-500",
    iconClasses: "bg-amber-100 text-amber-600",
    labelClasses: "text-amber-700",
  },
  {
    value: "COMMERCIAL",
    icon: BuildingStorefrontIcon,
    activeClasses: "border-green-500 bg-green-50 ring-2 ring-green-500",
    iconClasses: "bg-green-100 text-green-600",
    labelClasses: "text-green-700",
  },
] as const;

const CITY_OPTIONS = ["Salalah", "Muscat", "Other"] as const;

// ── Reusable field components ────────────────────────────────────────────────

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TextInput({
  id, name, placeholder, defaultValue, required, type = "text", min, max,
}: {
  id: string; name: string; placeholder?: string; defaultValue?: string | number;
  required?: boolean; type?: string; min?: number; max?: number;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      min={min}
      max={max}
      placeholder={placeholder}
      defaultValue={defaultValue ?? ""}
      required={required}
      className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
    />
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialData?: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    city: string | null;
    governorate: string | null;
    totalFloors: number | null;
    description: string | null;
    isActive: boolean;
    photos: string[];
  } | null;
}

export default function PropertyForm({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t       = useTranslations("buildings.form");
  const tTypes  = useTranslations("buildings.form.types");
  const tCities = useTranslations("buildings.form.cityOptions");

  const isEditMode = !!initialData;
  const storageFolder = `properties/${initialData?.id ?? crypto.randomUUID()}`;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState(initialData?.type ?? "RESIDENTIAL");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // City: detect if stored city is one of the options or custom
  const storedCity = initialData?.city ?? "Salalah";
  const isKnownCity = (CITY_OPTIONS as readonly string[]).includes(storedCity);
  const [citySelect, setCitySelect] = useState<string>(isKnownCity ? storedCity : "Other");
  const [cityCustom, setCityCustom] = useState(isKnownCity ? "" : storedCity);

  // Floors stepper
  const [floors, setFloors] = useState<number | "">(initialData?.totalFloors ?? "");

  // Description char count
  const [descLen, setDescLen] = useState(initialData?.description?.length ?? 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditMode
        ? await updateProperty(formData)
        : await createProperty(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? t("toasts.updated") : t("toasts.created"));
        // replace() instead of push() so the /new entry is dropped from history.
        // This makes the @modal slot evaluate against the destination URL,
        // hit default.tsx (null), and unmount the SlideOver.
        const dest = isEditMode
          ? `/dashboard/properties/${initialData.id}`
          : `/dashboard/properties/${result?.id}`;
        router.replace(dest);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hidden inputs */}
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}
      <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
      <input type="hidden" name="type" value={selectedType} />

      {/* ── Section 1: Basic Information ───────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3.5">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("basicSection")}</h3>
        </div>
        <div className="p-5 space-y-5">

          {/* Building Name */}
          <div>
            <FieldLabel htmlFor="name" required>{t("nameLabel")}</FieldLabel>
            <TextInput
              id="name"
              name="name"
              placeholder={t("namePlaceholder")}
              defaultValue={initialData?.name}
              required
            />
          </div>

          {/* Type Card Selector */}
          <div>
            <FieldLabel htmlFor="type-selector" required>{t("typeLabel")}</FieldLabel>
            <div id="type-selector" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PROPERTY_TYPES.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.value;
                const label = tTypes(`${opt.value}.label`);
                const sub   = tTypes(`${opt.value}.sub`);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedType(opt.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${
                      isSelected
                        ? opt.activeClasses
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      isSelected ? opt.iconClasses : "bg-gray-100 text-gray-400"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isSelected ? opt.labelClasses : "text-gray-700"}`}>
                        {label}
                      </p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{sub}</p>
                    </div>
                    {isSelected && (
                      <span className="absolute top-1.5 end-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M8.5 2.5L4 7.5 1.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total Floors + Active toggle row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Total Floors */}
            <div>
              <FieldLabel htmlFor="totalFloors">{t("totalFloorsLabel")}</FieldLabel>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t("decreaseFloors")}
                  onClick={() => setFloors((f) => Math.max(1, (Number(f) || 1) - 1))}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 transition text-lg font-semibold"
                >
                  −
                </button>
                <input
                  id="totalFloors"
                  name="totalFloors"
                  type="number"
                  min={1}
                  max={200}
                  value={floors}
                  onChange={(e) => setFloors(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  placeholder={t("totalFloorsPlaceholder")}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ltr-numbers"
                />
                <button
                  type="button"
                  aria-label={t("increaseFloors")}
                  onClick={() => setFloors((f) => (Number(f) || 0) + 1)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 transition text-lg font-semibold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Active / Inactive toggle */}
            <div>
              <FieldLabel htmlFor="active-toggle">{t("bookingStatusLabel")}</FieldLabel>
              <button
                id="active-toggle"
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-2.5 transition-all ${
                  isActive
                    ? "border-green-300 bg-green-50"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                <div className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  isActive ? "bg-green-500" : "bg-gray-300"
                }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    isActive ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                  }`} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">{t("activeAccepting")}</span>
                    </>
                  ) : (
                    <>
                      <WrenchScrewdriverIcon className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700">{t("inactiveHidden")}</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel htmlFor="description">{t("descriptionLabel")}</FieldLabel>
              <span className={`text-xs ltr-numbers ${descLen > 450 ? "text-amber-500" : "text-gray-400"}`}>
                {t("descriptionCount", { current: descLen, max: 500 })}
              </span>
            </div>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              defaultValue={initialData?.description ?? ""}
              onChange={(e) => setDescLen(e.target.value.length)}
              placeholder={t("descriptionPlaceholder")}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

        </div>
      </div>

      {/* ── Section 2: Location ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3.5">
          <MapPinIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("locationSection")}</h3>
        </div>
        <div className="p-5 space-y-4">

          {/* Street Address */}
          <div>
            <FieldLabel htmlFor="address">{t("addressLabel")}</FieldLabel>
            <TextInput
              id="address"
              name="address"
              placeholder={t("addressPlaceholder")}
              defaultValue={initialData?.address ?? ""}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* City dropdown */}
            <div className="sm:col-span-1">
              <FieldLabel htmlFor="city">{t("cityLabel")}</FieldLabel>
              <select
                id="city"
                name="city"
                value={citySelect}
                onChange={(e) => setCitySelect(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              >
                {CITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{tCities(c)}</option>
                ))}
              </select>
            </div>

            {/* Custom city (shown only when "Other") */}
            <div className={`sm:col-span-1 transition-all ${citySelect === "Other" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <FieldLabel htmlFor="cityCustom">{t("cityCustomLabel")}</FieldLabel>
              <input
                id="cityCustom"
                name="cityCustom"
                type="text"
                value={cityCustom}
                onChange={(e) => setCityCustom(e.target.value)}
                placeholder={t("cityCustomPlaceholder")}
                required={citySelect === "Other"}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Governorate */}
            <div className={citySelect === "Other" ? "sm:col-span-1" : "sm:col-span-2"}>
              <FieldLabel htmlFor="governorate">{t("governorateLabel")}</FieldLabel>
              <TextInput
                id="governorate"
                name="governorate"
                placeholder={t("governoratePlaceholder")}
                defaultValue={initialData?.governorate ?? "Dhofar"}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── Section 3: Photos ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3.5">
          <PhotoIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{t("photosSection")}</h3>
          <span className="text-xs text-gray-400 ms-auto">{t("photosHint")}</span>
        </div>
        <div className="p-5">
          <PhotoUpload
            initialPhotos={initialData?.photos ?? []}
            folder={storageFolder}
            name="photos"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8 bg-gray-50/50 sm:rounded-b-xl">
        <Link
          href={isEditMode ? `/dashboard/properties/${initialData.id}` : "/dashboard/properties"}
          className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
        >
          {t("cancel")}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? t("saving") : (isEditMode ? t("submitSave") : t("submitCreate"))}
        </button>
      </div>
    </form>
  );
}
