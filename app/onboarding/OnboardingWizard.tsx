"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  BuildingOffice2Icon,
  MapPinIcon,
  Cog6ToothIcon,
  PhotoIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { createOrganization } from "./actions";

// ── Static data ───────────────────────────────────────────────────────────────

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

const STEP_KEYS = ["company", "location", "preferences"] as const;
const STEP_ICONS = [BuildingOffice2Icon, MapPinIcon, Cog6ToothIcon];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  name:     string;
  phone:    string;
  logo:     File | null;
  address:  string;
  city:     string;
  area:     string;
  timezone: string;
  currency: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const t = useTranslations("auth.onboarding.steps");
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_KEYS.map((key, idx) => {
        const id      = idx + 1;
        const done    = current > id;
        const active  = current === id;
        const Icon    = STEP_ICONS[idx];

        return (
          <div key={key} className="flex items-center">
            {/* Connector line (before every step except first) */}
            {idx > 0 && (
              <div className={`h-px w-12 sm:w-20 transition-colors duration-500 ${done || active ? "bg-blue-500" : "bg-slate-700"}`} />
            )}

            {/* Step bubble */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                ${done   ? "border-blue-500 bg-blue-500 text-white"
                : active ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-lg shadow-blue-500/20"
                :          "border-slate-700 bg-slate-800 text-slate-500"}
              `}>
                {done
                  ? <CheckIcon className="h-5 w-5" />
                  : <Icon className="h-5 w-5" />
                }
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold transition-colors ${active ? "text-white" : done ? "text-blue-400" : "text-slate-500"}`}>
                  {t(`${key}.label`)}
                </p>
                <p className={`hidden sm:block text-[10px] transition-colors ${active ? "text-slate-400" : "text-slate-600"}`}>
                  {t(`${key}.description`)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InputField({
  label, name, value, onChange, placeholder, type = "text", required, hint,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-blue-400">*</span>}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, name, value, onChange, options,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Logo uploader ─────────────────────────────────────────────────────────────

function LogoUploader({
  file,
  onChange,
}: {
  file:     File | null;
  onChange: (f: File | null) => void;
}) {
  const t = useTranslations("auth.onboarding.company");
  const inputRef  = useRef<HTMLInputElement>(null);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {t("logoLabel")} <span className="text-slate-500 font-normal">{t("logoOptional")}</span>
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-600 bg-slate-800/40 px-5 py-4 transition hover:border-blue-500 hover:bg-slate-800"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={t("logoLabel")}
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700">
            <PhotoIcon className="h-7 w-7 text-slate-400" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-200">
            {file ? file.name : t("logoUploadCta")}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{t("logoHint")}</p>
        </div>
        {file && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="absolute end-3 top-3 rounded-full bg-slate-700 p-1 text-slate-400 hover:bg-red-800 hover:text-red-200 transition"
          >
            ✕
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
          if (f && f.size > 2 * 1024 * 1024) { alert(t("logoTooLarge")); return; }
          onChange(f);
        }}
      />
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const t        = useTranslations("auth.onboarding");
  const tCompany = useTranslations("auth.onboarding.company");
  const tLoc     = useTranslations("auth.onboarding.location");
  const tPref    = useTranslations("auth.onboarding.preferences");
  const tSum     = useTranslations("auth.onboarding.preferences.summary");
  const tStep    = useTranslations("auth.onboarding.steps");
  const tCommon  = useTranslations("auth.common");

  const [step, setStep] = useState(1);
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    name:     "",
    phone:    "",
    logo:     null,
    address:  "",
    city:     "Salalah",
    area:     "",
    timezone: "Asia/Muscat",
    currency: "OMR",
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  // ── Validate current step before advancing ────────────────────────────────

  function validateAndNext() {
    if (step === 1 && !form.name.trim()) {
      setError(t("errors.nameRequired"));
      return;
    }
    if (step === 2 && !form.city.trim()) {
      setError(t("errors.cityRequired"));
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  // ── Final submit ──────────────────────────────────────────────────────────

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("name",     form.name.trim());
      fd.append("phone",    form.phone.trim());
      fd.append("address",  form.address.trim());
      fd.append("city",     form.city.trim());
      fd.append("area",     form.area.trim());
      fd.append("timezone", form.timezone);
      fd.append("currency", form.currency);
      if (form.logo) fd.append("logo", form.logo);

      try {
        await createOrganization(fd);
      } catch {
        setError(t("errors.generic"));
      }
    });
  }

  const currentKey = STEP_KEYS[step - 1];

  // ── Animated step content ─────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg">

      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/40">
          <BuildingOffice2Icon className="h-7 w-7 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{t("header.title")}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{t("header.description")}</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Card */}
      <div
        className="rounded-2xl bg-slate-900/80 backdrop-blur-sm p-8 shadow-2xl ring-1 ring-white/5"
        style={{ animation: "heroFadeUp 0.35s cubic-bezier(.4,0,.2,1) both" }}
        key={step}
      >
        {/* Step title */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">{tStep(`${currentKey}.label`)}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{tStep(`${currentKey}.description`)}</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Step 1: Company ── */}
        {step === 1 && (
          <div className="space-y-5">
            <InputField
              label={tCompany("nameLabel")}
              name="name"
              value={form.name}
              onChange={(v) => set("name", v)}
              placeholder={tCompany("namePlaceholder")}
              required
            />
            <InputField
              label={tCompany("phoneLabel")}
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(v) => set("phone", v)}
              placeholder={tCompany("phonePlaceholder")}
            />
            <LogoUploader
              file={form.logo}
              onChange={(f) => set("logo", f)}
            />
          </div>
        )}

        {/* ── Step 2: Location ── */}
        {step === 2 && (
          <div className="space-y-5">
            <InputField
              label={tLoc("addressLabel")}
              name="address"
              value={form.address}
              onChange={(v) => set("address", v)}
              placeholder={tLoc("addressPlaceholder")}
            />
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label={tLoc("cityLabel")}
                name="city"
                value={form.city}
                onChange={(v) => set("city", v)}
                placeholder={tLoc("cityPlaceholder")}
                required
              />
              <InputField
                label={tLoc("areaLabel")}
                name="area"
                value={form.area}
                onChange={(v) => set("area", v)}
                placeholder={tLoc("areaPlaceholder")}
              />
            </div>
            <div className="rounded-xl bg-slate-800/50 px-4 py-3 text-xs text-slate-400">
              {tLoc.rich("defaultsHint", {
                b: (chunks) => <span className="text-slate-200 font-medium">{chunks}</span>,
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Preferences ── */}
        {step === 3 && (
          <div className="space-y-5">
            <SelectField
              label={tPref("timezoneLabel")}
              name="timezone"
              value={form.timezone}
              onChange={(v) => set("timezone", v)}
              options={TIMEZONES}
            />
            <SelectField
              label={tPref("currencyLabel")}
              name="currency"
              value={form.currency}
              onChange={(v) => set("currency", v)}
              options={CURRENCIES}
            />
            <div className="rounded-xl bg-slate-800/50 px-4 py-3 text-xs text-slate-400">
              {tPref.rich("settingsHint", {
                b: (chunks) => <span className="text-slate-200 font-medium">{chunks}</span>,
              })}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{tSum("title")}</p>
              {[
                { label: tSum("company"),  value: form.name },
                { label: tSum("phone"),    value: form.phone    || tSum("empty") },
                { label: tSum("city"),     value: form.city },
                { label: tSum("address"),  value: form.address  || tSum("empty") },
                { label: tSum("timezone"), value: form.timezone },
                { label: tSum("currency"), value: form.currency },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="text-slate-200 font-medium truncate max-w-[60%] text-end">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => { setStep((s) => s - 1); setError(null); }}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" /> {tCommon("back")}
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={validateAndNext}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 hover:-translate-y-0.5 transition-all"
            >
              {tCommon("next")} <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t("creatingButton")}
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" /> {t("createButton")}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Step counter */}
      <p className="mt-4 text-center text-xs text-slate-600">
        {t("stepCounter", { current: step, total: STEP_KEYS.length })}
      </p>
    </div>
  );
}
