"use client";

import { useTranslations } from "next-intl";
import { TextField, TextArea, Toggle } from "@/components/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { COLOR_PRESETS, TEMPLATES, HEX_RE, type WebsiteForm, type TemplateKey } from "./types";
import SlugField, { type SlugStatus } from "./SlugField";
import ImageField from "./ImageField";
import LivePreview from "./LivePreview";

type Update = (patch: Partial<WebsiteForm>) => void;

/* ── Language segmented toggle (ar/en) ─────────────────────────────────────── */
function LangToggle({ value, onChange }: { value: "ar" | "en"; onChange: (v: "ar" | "en") => void }) {
  const t = useTranslations("settings.website");
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
      {(["ar", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded-md px-3 py-1 transition ${value === l ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}

/* ── Colour controls: presets + custom pickers ─────────────────────────────── */
function ColorControls({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  const swatch = (hex: string, key: "primaryColor" | "accentColor", label: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2" dir="ltr">
        <input
          type="color"
          value={HEX_RE.test(hex) ? hex : "#000000"}
          onChange={(e) => update({ [key]: e.target.value } as Partial<WebsiteForm>)}
          className="h-9 w-11 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
        />
        <input
          value={hex}
          onChange={(e) => update({ [key]: e.target.value } as Partial<WebsiteForm>)}
          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("fields.presets")}</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((p) => {
            const active = p.primary.toLowerCase() === form.primaryColor.toLowerCase() && p.accent.toLowerCase() === form.accentColor.toLowerCase();
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => update({ primaryColor: p.primary, accentColor: p.accent })}
                title={t(`presets.${p.name}`)}
                className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 transition ${active ? "ring-gray-900" : "ring-transparent hover:ring-gray-300"}`}
              >
                <span className="flex h-full w-full">
                  <span className="h-full w-1/2" style={{ background: p.primary }} />
                  <span className="h-full w-1/2" style={{ background: p.accent }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-4">
        {swatch(form.primaryColor, "primaryColor", t("fields.primaryColor"))}
        {swatch(form.accentColor, "accentColor", t("fields.accentColor"))}
      </div>
    </div>
  );
}

/* ── STEP 1 — Basics ───────────────────────────────────────────────────────── */
export function StepBasics({
  form, update, rootDomain, onSlugStatus,
}: { form: WebsiteForm; update: Update; rootDomain: string; onSlugStatus: (s: SlugStatus) => void }) {
  const t = useTranslations("settings.website");
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("fields.siteNameEn")}
          value={form.siteNameEn}
          onChange={(e) => update({ siteNameEn: e.target.value })}
          placeholder="Nassayem Salalah"
          dir="ltr"
        />
        <TextField
          label={t("fields.siteNameAr")}
          value={form.siteNameAr}
          onChange={(e) => update({ siteNameAr: e.target.value })}
          placeholder="نسائم صلالة"
          dir="rtl"
        />
      </div>

      <SlugField value={form.slug} onChange={(v) => update({ slug: v })} onStatus={onSlugStatus} rootDomain={rootDomain} />

      <ImageField
        value={form.logoUrl}
        onChange={(url) => update({ logoUrl: url })}
        folder="sites/logos"
        label={t("fields.logo")}
        hint={t("upload.logoHint")}
      />

      <ColorControls form={form} update={update} />

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-700">{t("fields.defaultLanguage")}</p>
          <p className="text-xs text-gray-500">{t("fields.defaultLanguageHint")}</p>
        </div>
        <LangToggle value={form.defaultLanguage} onChange={(v) => update({ defaultLanguage: v })} />
      </div>
    </div>
  );
}

/* ── STEP 2 — Contact & content ────────────────────────────────────────────── */
export function StepContact({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("fields.whatsapp")}
          required
          value={form.whatsappNumber}
          onChange={(e) => update({ whatsappNumber: e.target.value })}
          placeholder="96890000000"
          dir="ltr"
          helperText={t("fields.whatsappHint")}
        />
        <TextField label={t("fields.phone")} value={form.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+968…" dir="ltr" />
        <TextField label={t("fields.email")} type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="hello@example.com" dir="ltr" />
        <TextField label={t("fields.instagram")} value={form.instagramUrl} onChange={(e) => update({ instagramUrl: e.target.value })} placeholder="https://instagram.com/…" dir="ltr" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("fields.addressEn")} value={form.addressEn} onChange={(e) => update({ addressEn: e.target.value })} dir="ltr" />
        <TextField label={t("fields.addressAr")} value={form.addressAr} onChange={(e) => update({ addressAr: e.target.value })} dir="rtl" />
      </div>
      <TextField label={t("fields.googleMaps")} value={form.googleMapsUrl} onChange={(e) => update({ googleMapsUrl: e.target.value })} placeholder="https://maps.google.com/…" dir="ltr" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("fields.taglineEn")} value={form.taglineEn} onChange={(e) => update({ taglineEn: e.target.value })} dir="ltr" />
        <TextField label={t("fields.taglineAr")} value={form.taglineAr} onChange={(e) => update({ taglineAr: e.target.value })} dir="rtl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea label={t("fields.aboutEn")} value={form.aboutEn} onChange={(e) => update({ aboutEn: e.target.value })} minRows={3} dir="ltr" />
        <TextArea label={t("fields.aboutAr")} value={form.aboutAr} onChange={(e) => update({ aboutAr: e.target.value })} minRows={3} dir="rtl" />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <Toggle
          label={t("fields.showPrices")}
          description={t("fields.showPricesHint")}
          checked={form.showPrices}
          onCheckedChange={(c) => update({ showPrices: c })}
        />
        <Toggle
          label={t("fields.khareefBanner")}
          description={t("fields.khareefBannerHint")}
          checked={form.khareefBannerEnabled}
          onCheckedChange={(c) => update({ khareefBannerEnabled: c })}
        />
      </div>
    </div>
  );
}

/* ── STEP 3 — Template gallery ─────────────────────────────────────────────── */
export function StepTemplates({
  form, update, previewLang, setPreviewLang,
}: { form: WebsiteForm; update: Update; previewLang: "ar" | "en"; setPreviewLang: (l: "ar" | "en") => void }) {
  const t = useTranslations("settings.website");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{t("templates.intro")}</p>
        <LangToggle value={previewLang} onChange={setPreviewLang} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {TEMPLATES.map((tpl) => {
          const active = form.templateKey === tpl.key;
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => update({ templateKey: tpl.key })}
              className={`group relative rounded-2xl p-1.5 text-left ring-2 transition ${active ? "ring-blue-500" : "ring-transparent hover:ring-gray-200"}`}
            >
              {active && (
                <span className="absolute -right-2 -top-2 z-10 rounded-full bg-blue-500 p-0.5 text-white shadow">
                  <CheckCircleIcon className="h-5 w-5" />
                </span>
              )}
              <LivePreview form={form} template={tpl.key} lang={previewLang} compact />
              <div className="px-1 py-2">
                <div className="text-sm font-semibold text-gray-900">{t(`templates.${tpl.key}.name`)}</div>
                <div className="text-xs text-gray-500">{t(`templates.${tpl.key}.desc`)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── STEP 4 — Review & launch ──────────────────────────────────────────────── */
export function StepReview({ form, rootDomain }: { form: WebsiteForm; rootDomain: string }) {
  const t = useTranslations("settings.website");
  const lang = form.defaultLanguage;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="text-end text-sm text-gray-900">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <LivePreview form={form} template={form.templateKey} lang={lang} />
        <p className="mt-2 text-center text-xs text-gray-400">{t("review.previewNote")}</p>
      </div>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
        {row(t("fields.subdomain"), <span dir="ltr">{form.slug}.{rootDomain}</span>)}
        {row(t("review.name"), (lang === "ar" ? form.siteNameAr : form.siteNameEn) || form.siteNameEn || form.siteNameAr)}
        {row(t("templates.label"), t(`templates.${form.templateKey}.name`))}
        {row(t("fields.whatsapp"), <span dir="ltr">{form.whatsappNumber}</span>)}
        {row(t("fields.defaultLanguage"), t(`lang.${form.defaultLanguage}`))}
        {row(t("fields.showPrices"), t(form.showPrices ? "yes" : "no"))}
        {row(t("fields.khareefBanner"), t(form.khareefBannerEnabled ? "yes" : "no"))}
      </div>
    </div>
  );
}
