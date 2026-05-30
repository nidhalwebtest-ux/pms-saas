"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckIcon,
  PhotoIcon,
  XMarkIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { updateOrganization } from "./actions";
import { Alert, Button } from "@/components/ui";

const TIMEZONES = [
  { value: "Asia/Muscat",       label: "(GMT+4) Asia/Muscat — Oman" },
  { value: "Asia/Dubai",        label: "(GMT+4) Asia/Dubai — UAE" },
  { value: "Asia/Riyadh",       label: "(GMT+3) Asia/Riyadh — Saudi Arabia" },
  { value: "Asia/Kuwait",       label: "(GMT+3) Asia/Kuwait — Kuwait" },
  { value: "Asia/Bahrain",      label: "(GMT+3) Asia/Bahrain — Bahrain" },
  { value: "Asia/Qatar",        label: "(GMT+3) Asia/Qatar — Qatar" },
  { value: "Africa/Cairo",      label: "(GMT+2) Africa/Cairo — Egypt" },
  { value: "Europe/London",     label: "(GMT+0) Europe/London — UK" },
  { value: "America/New_York",  label: "(GMT-5) America/New_York — US Eastern" },
];

const CURRENCIES = [
  { value: "OMR", label: "OMR — Omani Rial" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
];

type CheckInPolicy = "ALLOW_BACK_TO_BACK" | "REQUIRE_VACANT";

type FormState = {
  name: string;
  phone: string;
  address: string;
  city: string;
  area: string;
  logo: string | null;
  timezone: string;
  currency: string;
  checkInPolicy: CheckInPolicy;
};

export default function OrgSettingsForm({ org }: { org: FormState }) {
  const t       = useTranslations("settings.organization");
  const tErr    = useTranslations("auth.onboarding.errors");
  const router  = useRouter();
  const [form, setForm] = useState<FormState>(org);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: "name"; message: string } | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const dirty =
    form.name     !== org.name     ||
    form.phone    !== org.phone    ||
    form.address  !== org.address  ||
    form.city     !== org.city     ||
    form.area     !== org.area     ||
    form.timezone !== org.timezone ||
    form.currency !== org.currency ||
    form.checkInPolicy !== org.checkInPolicy ||
    logoFile      !== null         ||
    removeLogo;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setBannerError(null);
    if (fieldError && key === fieldError.field) setFieldError(null);
  }

  const previewLogoUrl = logoFile
    ? URL.createObjectURL(logoFile)
    : removeLogo
      ? null
      : form.logo;

  function handleSave() {
    setBannerError(null);
    setFieldError(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("name",     form.name.trim());
      fd.append("phone",    form.phone.trim());
      fd.append("address",  form.address.trim());
      fd.append("city",     form.city.trim());
      fd.append("area",     form.area.trim());
      fd.append("timezone", form.timezone);
      fd.append("currency", form.currency);
      fd.append("checkInPolicy", form.checkInPolicy);
      if (logoFile) fd.append("logo", logoFile);
      if (removeLogo) fd.append("removeLogo", "1");

      let result;
      try {
        result = await updateOrganization(fd);
      } catch {
        setBannerError(tErr("generic"));
        return;
      }

      if (result.ok) {
        toast.success(t("savedToast"));
        setLogoFile(null);
        setRemoveLogo(false);
        router.refresh();
        return;
      }

      const errKey = `${result.error}` as
        | "name_required" | "name_too_long" | "duplicate_name"
        | "city_required" | "generic" | "unauthorized" | "no_org" | "forbidden";
      const message = (errKey === "name_required" || errKey === "name_too_long" ||
                       errKey === "duplicate_name" || errKey === "city_required" ||
                       errKey === "generic")
        ? tErr(errKey)
        : tErr("generic");

      if (result.field === "name") {
        setFieldError({ field: "name", message });
      } else {
        setBannerError(message);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 space-y-5">
      {bannerError && <Alert variant="error" description={bannerError} />}

      {/* Company name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("nameLabel")} <span className="text-blue-600">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={!!fieldError || undefined}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
            fieldError
              ? "border-red-300 bg-red-50 focus:ring-red-400"
              : "border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500/30"
          }`}
        />
        {fieldError && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
            <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
            {fieldError.message}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("phoneLabel")}
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("addressLabel")}
        </label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* City + Area */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("cityLabel")} <span className="text-blue-600">*</span>
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("areaLabel")}
          </label>
          <input
            type="text"
            value={form.area}
            onChange={(e) => set("area", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* Timezone + Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("timezoneLabel")}
          </label>
          <select
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("currencyLabel")}
          </label>
          <select
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Check-in policy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("checkInPolicyLabel")}
        </label>
        <p className="text-xs text-gray-500 mb-2">{t("checkInPolicyHint")}</p>
        <div className="space-y-2">
          {(["ALLOW_BACK_TO_BACK", "REQUIRE_VACANT"] as const).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                form.checkInPolicy === value
                  ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="checkInPolicy"
                value={value}
                checked={form.checkInPolicy === value}
                onChange={() => set("checkInPolicy", value)}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500/30"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-gray-800">
                  {t(value === "ALLOW_BACK_TO_BACK" ? "checkInPolicyBackToBackTitle" : "checkInPolicyRequireVacantTitle")}
                </span>
                <span className="text-xs text-gray-500">
                  {t(value === "ALLOW_BACK_TO_BACK" ? "checkInPolicyBackToBackDesc" : "checkInPolicyRequireVacantDesc")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("logoLabel")}
        </label>
        <div
          onClick={() => inputRef.current?.click()}
          className="relative flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50/30"
        >
          {previewLogoUrl ? (
            <Image
              src={previewLogoUrl}
              alt={t("logoLabel")}
              width={56}
              height={56}
              className="h-14 w-14 rounded-lg object-cover ring-1 ring-gray-200"
              unoptimized
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
              <PhotoIcon className="h-7 w-7 text-gray-300" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {logoFile ? logoFile.name : previewLogoUrl ? t("logoChange") : t("logoUpload")}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{t("logoHint")}</p>
          </div>
          {(logoFile || (form.logo && !removeLogo)) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLogoFile(null);
                setRemoveLogo(true);
              }}
              className="rounded-full bg-white p-1.5 text-gray-400 ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600 transition"
              title={t("logoRemove")}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 2 * 1024 * 1024) {
              toast.error(t("logoTooLarge"));
              return;
            }
            setLogoFile(f);
            setRemoveLogo(false);
          }}
        />
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setForm(org);
              setLogoFile(null);
              setRemoveLogo(false);
              setFieldError(null);
              setBannerError(null);
            }}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("revert")}
          </button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          loading={isPending}
          disabled={!dirty}
          leftIcon={<CheckIcon className="h-4 w-4" />}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
