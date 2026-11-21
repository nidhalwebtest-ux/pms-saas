"use client";

import { useTranslations } from "next-intl";
import { fontStackFor } from "@/lib/public-site/fonts";
import { themeFor } from "@/lib/public-site/theme";
import type { TemplateKey, WebsiteForm } from "./types";

/**
 * A miniature, brand-applied mock of the public site. Re-renders live as the user edits
 * colours / logo / name / template / font. Each template mirrors the real layout of its
 * public home page (Coastal: photo hero · Classic: centred, framed · Modern: dark split hero).
 */
export default function LivePreview({
  form,
  template,
  lang,
  compact = false,
}: {
  form: WebsiteForm;
  template: TemplateKey;
  lang: "ar" | "en";
  compact?: boolean;
}) {
  const t = useTranslations("settings.website");
  const ar = lang === "ar";
  const name = (ar ? form.siteNameAr : form.siteNameEn) || form.siteNameEn || form.siteNameAr || t("preview.yourHotel");
  const tagline = (ar ? form.taglineAr : form.taglineEn) || t("preview.tagline");
  const dir = ar ? "rtl" : "ltr";
  const display = fontStackFor(form.fontPreset) ?? themeFor(template).fontStack;

  const vars = { "--p": form.primaryColor, "--a": form.accentColor } as React.CSSProperties;
  const photo = "linear-gradient(135deg, color-mix(in srgb, var(--p) 55%, #fff), color-mix(in srgb, var(--a) 60%, var(--p)))";

  const Logo = ({ size, white = false }: { size: number; white?: boolean }) =>
    form.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={form.logoUrl} alt="" style={{ height: size, width: size }} className={`rounded-md object-contain ${white ? "bg-white p-0.5" : ""}`} />
    ) : (
      <div style={{ height: size, width: size, background: "var(--p)", fontSize: size * 0.5 }} className="flex items-center justify-center rounded-md font-bold text-white">
        {name.charAt(0)}
      </div>
    );

  const frameH = compact ? "h-44" : "h-72";

  return (
    <div dir={dir} style={vars} className={`flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10 ${frameH}`}>
      {/* browser chrome */}
      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1">
        <span className="h-2 w-2 rounded-full bg-red-300" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-green-300" />
        <span className="ms-2 truncate rounded bg-white px-2 py-0.5 text-[9px] text-gray-400" dir="ltr">
          {form.slug || "your-site"}.binaya.app
        </span>
      </div>

      {/* ── Coastal: light bar, full-photo hero, overlapping search, card row ── */}
      {template === "template_1" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <div className="flex items-center gap-1.5"><Logo size={16} /><span className="text-[10px] font-semibold" style={{ color: "var(--p)", fontFamily: display }}>{name}</span></div>
            <div className="h-3 w-10 rounded-full" style={{ background: "var(--a)" }} />
          </div>
          <div className="relative flex-1" style={{ background: photo }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/25" />
            <div className="absolute inset-x-3 bottom-5 text-start">
              <div className="text-[15px] font-semibold leading-tight text-white" style={{ fontFamily: display }}>{name}</div>
              <div className="mt-0.5 line-clamp-1 text-[9px] text-white/85">{tagline}</div>
            </div>
            <div className="absolute inset-x-5 -bottom-2.5 flex gap-1 rounded-full bg-white p-1 shadow-lg ring-1 ring-black/5">
              <div className="h-3.5 flex-1 rounded-full bg-slate-100" /><div className="h-3.5 flex-1 rounded-full bg-slate-100" />
              <div className="h-3.5 w-9 rounded-full" style={{ background: "var(--p)" }} />
            </div>
          </div>
          <div className="mt-3 flex gap-1.5 px-3 pb-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 overflow-hidden rounded-lg ring-1 ring-slate-200">
                <div className="h-5" style={{ background: `color-mix(in srgb, var(--p) ${20 + i * 8}%, #fff)` }} />
                <div className="m-1 h-1 w-2/3 rounded bg-slate-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Classic: centred header, framed hero, editorial row ── */}
      {template === "template_2" && (
        <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#fbf9f3" }}>
          <div className="flex flex-col items-center gap-0.5 border-b border-stone-300 py-1.5">
            <Logo size={14} />
            <span className="text-[10px] leading-none" style={{ color: "var(--p)", fontFamily: display }}>{name}</span>
          </div>
          <div className="m-2 bg-white p-1 ring-1 ring-stone-300">
            <div className="relative flex h-[68px] flex-col items-center justify-center gap-1 overflow-hidden px-3 text-center" style={{ background: photo }}>
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative text-[13px] leading-none text-white" style={{ fontFamily: display }}>{name}</div>
              <div className="relative h-px w-8 bg-white/60" />
              <div className="relative line-clamp-1 text-[8px] italic text-white/85">{tagline}</div>
            </div>
          </div>
          <div className="-mt-4 flex justify-center">
            <div className="flex items-center gap-1 bg-white p-1 shadow-md ring-1 ring-stone-300">
              <div className="h-3 w-10 bg-stone-100" /><div className="h-3 w-10 bg-stone-100" /><div className="h-3 w-8" style={{ background: "var(--p)" }} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 px-3">
            <div className="h-9 w-14 bg-white p-0.5 ring-1 ring-stone-300"><div className="h-full w-full" style={{ background: `color-mix(in srgb, var(--p) 30%, #fff)` }} /></div>
            <div className="flex-1 space-y-1">
              <div className="h-1 w-8" style={{ background: "var(--a)" }} />
              <div className="h-1.5 w-2/3 rounded bg-stone-400" />
              <div className="h-1 w-1/2 rounded bg-stone-200" />
            </div>
          </div>
        </div>
      )}

      {/* ── Modern: dark bar, split hero, bento tiles ── */}
      {template === "template_3" && (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
            <div className="flex items-center gap-1.5"><Logo size={16} white /><span className="text-[10px] font-bold text-white" style={{ fontFamily: display }}>{name}</span></div>
            <div className="h-3 w-9 rounded" style={{ background: "var(--a)" }} />
          </div>
          <div className="grid flex-1 grid-cols-[1.1fr_1fr] items-center gap-2 px-3">
            <div>
              <div className="mb-1 h-2 w-9 rounded-sm" style={{ background: "var(--a)" }} />
              <div className="text-[14px] font-bold leading-[1.05] text-white" style={{ fontFamily: display }}>{name}</div>
              <div className="mt-1 line-clamp-1 text-[8px] text-white/60">{tagline}</div>
              <div className="mt-1.5 grid grid-cols-2 gap-0.5 rounded-md bg-white p-0.5">
                <div className="h-2.5 rounded-sm bg-slate-100" /><div className="h-2.5 rounded-sm bg-slate-100" />
                <div className="h-2.5 rounded-sm bg-slate-100" /><div className="h-2.5 rounded-sm" style={{ background: "var(--p)" }} />
              </div>
            </div>
            <div className="h-[84%] rounded-lg ring-1 ring-white/15" style={{ background: photo }} />
          </div>
          <div className="grid h-9 grid-cols-3 gap-1 bg-white p-1.5">
            <div className="col-span-2 rounded" style={{ background: `color-mix(in srgb, var(--p) 40%, #fff)` }} />
            <div className="rounded" style={{ background: `color-mix(in srgb, var(--a) 50%, #fff)` }} />
          </div>
        </div>
      )}
    </div>
  );
}
