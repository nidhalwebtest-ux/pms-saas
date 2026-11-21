"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowUpIcon, ArrowDownIcon, PlusIcon, TrashIcon, PhotoIcon, StarIcon as StarOutline,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { TextField, TextArea, Toggle, Spinner } from "@/components/ui";
import { uploadMedia } from "@/app/(main)/dashboard/actions/upload-media";
import { MAX_GALLERY, MAX_REVIEWS, type SectionKey } from "@/lib/public-site/sections";
import type { WebsiteForm } from "./types";

type Update = (patch: Partial<WebsiteForm>) => void;

/** Does this section have anything to show yet? (Empty sections render nothing on the site.) */
function hasContent(key: SectionKey, f: WebsiteForm): boolean {
  switch (key) {
    case "about": return !!(f.aboutEn.trim() || f.aboutAr.trim());
    case "reviews": return f.reviews.length > 0;
    case "policies": return !!(f.checkInTime || f.checkOutTime || f.policiesEn.trim() || f.policiesAr.trim());
    case "location": return !!(f.addressEn.trim() || f.addressAr.trim() || f.googleMapsUrl.trim());
    default: return true; // highlights / khareef / featured / gallery (falls back to building photos)
  }
}

const card = "rounded-xl border border-gray-200 bg-white p-4";

/* ── Section list: show / hide + reorder ───────────────────────────────────── */
function SectionList({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");

  const isOn = (key: SectionKey, enabled: boolean) => (key === "khareef" ? form.khareefBannerEnabled : enabled);
  const setOn = (key: SectionKey, on: boolean) =>
    key === "khareef"
      ? update({ khareefBannerEnabled: on })
      : update({ sections: form.sections.map((s) => (s.key === key ? { ...s, enabled: on } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= form.sections.length) return;
    const a = [...form.sections];
    [a[i], a[j]] = [a[j], a[i]];
    update({ sections: a });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{t("content.sectionsTitle")}</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{t("content.sectionsHint")}</p>
      <ol className="space-y-2">
        <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">{t("content.heroFixed")}</li>
        {form.sections.map((s, i) => {
          const on = isOn(s.key, s.enabled);
          const empty = on && !hasContent(s.key, form);
          return (
            <li key={s.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${on ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"}`}>
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("content.moveUp")} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === form.sections.length - 1} aria-label={t("content.moveDown")} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${on ? "text-gray-900" : "text-gray-400"}`}>{t(`content.sections.${s.key}.name`)}</p>
                <p className="truncate text-xs text-gray-500">{t(`content.sections.${s.key}.desc`)}</p>
                {empty && <p className="mt-0.5 text-xs font-medium text-amber-600">{t("content.needsContent")}</p>}
              </div>
              <Toggle label="" aria-label={t(`content.sections.${s.key}.name`)} checked={on} onCheckedChange={(c) => setOn(s.key, c)} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Gallery: multi-upload ─────────────────────────────────────────────────── */
function GalleryEditor({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_GALLERY - form.galleryUrls.length;
    const picked = [...files].slice(0, room);
    if (files.length > room) toast.error(t("content.galleryMax", { n: MAX_GALLERY }));
    setBusy(true);
    const urls: string[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) { toast.error(t("upload.notImage")); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(t("upload.tooLarge")); continue; }
      const fd = new FormData();
      fd.append("folder", "sites/gallery");
      fd.append("file", file);
      const res = await uploadMedia(fd);
      if (res.ok) urls.push(res.url); else toast.error(t("upload.failed"));
    }
    setBusy(false);
    if (urls.length) update({ galleryUrls: [...form.galleryUrls, ...urls] });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-gray-900">{t("content.galleryTitle")}</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{t("content.galleryHint")}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {form.galleryUrls.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => update({ galleryUrls: form.galleryUrls.filter((_, j) => j !== i) })}
              aria-label={t("upload.remove")}
              className="absolute end-1 top-1 rounded-full bg-white/90 p-1 text-gray-500 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {form.galleryUrls.length < MAX_GALLERY && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 transition hover:border-blue-400 hover:text-blue-500 disabled:opacity-60"
          >
            {busy ? <Spinner size={20} /> : <PhotoIcon className="h-6 w-6" />}
            <span className="text-[11px] font-medium">{t("content.galleryAdd")}</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400">{form.galleryUrls.length}/{MAX_GALLERY}{form.galleryUrls.length === 0 ? ` · ${t("content.galleryFallback")}` : ""}</p>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}

/* ── Reviews ───────────────────────────────────────────────────────────────── */
function ReviewsEditor({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  const set = (i: number, patch: Partial<WebsiteForm["reviews"][number]>) =>
    update({ reviews: form.reviews.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-gray-900">{t("content.reviewsTitle")}</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{t("content.reviewsHint")}</p>
      <div className="space-y-3">
        {form.reviews.map((r, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <TextField label={t("content.reviewName")} value={r.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={80} />
              </div>
              <div className="pb-2">
                <div className="flex gap-0.5" role="radiogroup" aria-label={t("content.reviewRating")}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => set(i, { rating: n })} aria-label={`${n}`} className="p-0.5">
                      {n <= r.rating ? <StarIcon className="h-5 w-5 text-amber-400" /> : <StarOutline className="h-5 w-5 text-gray-300" />}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => update({ reviews: form.reviews.filter((_, j) => j !== i) })} aria-label={t("upload.remove")} className="mb-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <TextArea label={t("content.reviewTextEn")} value={r.textEn} onChange={(e) => set(i, { textEn: e.target.value })} minRows={2} dir="ltr" maxLength={600} />
              <TextArea label={t("content.reviewTextAr")} value={r.textAr} onChange={(e) => set(i, { textAr: e.target.value })} minRows={2} dir="rtl" maxLength={600} />
            </div>
          </div>
        ))}
      </div>
      {form.reviews.length < MAX_REVIEWS && (
        <button
          type="button"
          onClick={() => update({ reviews: [...form.reviews, { name: "", textEn: "", textAr: "", rating: 5 }] })}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          <PlusIcon className="h-4 w-4" /> {t("content.reviewAdd")}
        </button>
      )}
      <p className="mt-2 text-xs text-gray-400">{t("content.reviewsNote")}</p>
    </div>
  );
}

/* ── Policies ──────────────────────────────────────────────────────────────── */
function PoliciesEditor({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  const time = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-gray-900">{t("content.policiesTitle")}</h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">{t("content.policiesHint")}</p>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">{t("content.checkIn")}</span>
          <input type="time" dir="ltr" value={form.checkInTime} onChange={(e) => update({ checkInTime: e.target.value })} className={time} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">{t("content.checkOut")}</span>
          <input type="time" dir="ltr" value={form.checkOutTime} onChange={(e) => update({ checkOutTime: e.target.value })} className={time} />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextArea label={t("content.policiesEn")} value={form.policiesEn} onChange={(e) => update({ policiesEn: e.target.value })} minRows={4} dir="ltr" maxLength={4000} />
        <TextArea label={t("content.policiesAr")} value={form.policiesAr} onChange={(e) => update({ policiesAr: e.target.value })} minRows={4} dir="rtl" maxLength={4000} />
      </div>
    </div>
  );
}

/** Step 4 — Sections & content: choose what shows and in what order, and fill the new sections. */
export function StepContent({ form, update }: { form: WebsiteForm; update: Update }) {
  const t = useTranslations("settings.website");
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">{t("content.intro")}</p>
      <SectionList form={form} update={update} />
      <GalleryEditor form={form} update={update} />
      <ReviewsEditor form={form} update={update} />
      <PoliciesEditor form={form} update={update} />
      <p className="text-xs text-gray-500">{t("content.locationNote")}</p>
    </div>
  );
}
