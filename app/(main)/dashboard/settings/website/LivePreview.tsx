"use client";

import { useTranslations } from "next-intl";
import type { TemplateKey, WebsiteForm } from "./types";

/**
 * A miniature, brand-applied mock of the public site. Re-renders live as the
 * user edits colours/logo/name/template — the "preview with your branding" the
 * brief asks for. Purely presentational (not the real template — that's Phase 4).
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

  const vars = { "--p": form.primaryColor, "--a": form.accentColor } as React.CSSProperties;

  const Logo = ({ size }: { size: number }) =>
    form.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={form.logoUrl} alt="" style={{ height: size, width: size }} className="rounded-lg object-contain bg-white/80 p-0.5" />
    ) : (
      <div
        style={{ height: size, width: size, background: "var(--a)" }}
        className="flex items-center justify-center rounded-lg font-bold text-white"
      >
        {name.charAt(0)}
      </div>
    );

  // Fake "available units" chips shared by all templates.
  const Chips = () => (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex-1 rounded-md bg-white/90 p-1.5 shadow-sm ring-1 ring-black/5">
          <div className="h-6 rounded" style={{ background: `color-mix(in srgb, var(--p) ${18 + i * 6}%, #fff)` }} />
          <div className="mt-1 h-1.5 w-2/3 rounded" style={{ background: "var(--p)" }} />
        </div>
      ))}
    </div>
  );

  const frameH = compact ? "h-40" : "h-64";

  return (
    <div dir={dir} style={vars} className={`overflow-hidden rounded-xl ring-1 ring-black/10 shadow-sm ${frameH} flex flex-col bg-white`}>
      {/* browser chrome */}
      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1">
        <span className="h-2 w-2 rounded-full bg-red-300" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-green-300" />
        <span className="ms-2 truncate rounded bg-white px-2 py-0.5 text-[9px] text-gray-400" dir="ltr">
          {form.slug || "your-site"}.binaya.app
        </span>
      </div>

      {/* ── Template 1 — Coastal: light, airy, centered ── */}
      {template === "template_1" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5"><Logo size={18} /><span className="text-[11px] font-semibold" style={{ color: "var(--p)" }}>{name}</span></div>
            <div className="h-1.5 w-10 rounded-full" style={{ background: "color-mix(in srgb, var(--p) 25%, #fff)" }} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center"
               style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--p) 10%, #fff), color-mix(in srgb, var(--a) 12%, #fff))" }}>
            <div className="text-sm font-bold" style={{ color: "var(--p)" }}>{name}</div>
            <div className="text-[10px] text-gray-500 line-clamp-2">{tagline}</div>
            <div className="mt-1 rounded-full px-3 py-1 text-[10px] font-semibold text-white shadow" style={{ background: "var(--a)" }}>
              {t("preview.searchCta")}
            </div>
          </div>
          <div className="px-3 py-2"><Chips /></div>
        </div>
      )}

      {/* ── Template 2 — Classic: elegant, serif, cream ── */}
      {template === "template_2" && (
        <div className="flex flex-1 flex-col" style={{ background: "#fbf9f4", fontFamily: "Georgia, serif" }}>
          <div className="flex flex-col items-center gap-1 border-b px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--p) 20%, #fff)" }}>
            <Logo size={20} />
            <span className="text-[11px] tracking-wide" style={{ color: "var(--p)" }}>{name}</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center">
            <div className="text-[15px] font-semibold" style={{ color: "var(--p)" }}>{name}</div>
            <div className="mx-auto h-px w-10" style={{ background: "var(--a)" }} />
            <div className="text-[10px] italic text-gray-500 line-clamp-2">{tagline}</div>
            <div className="mt-1 border px-3 py-1 text-[10px] font-medium" style={{ borderColor: "var(--p)", color: "var(--p)" }}>
              {t("preview.searchCta")}
            </div>
          </div>
          <div className="px-3 py-2"><Chips /></div>
        </div>
      )}

      {/* ── Template 3 — Modern: bold, dark hero ── */}
      {template === "template_3" && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center gap-1.5 px-4" style={{ background: "var(--p)" }}>
            <div className="flex items-center gap-1.5"><Logo size={18} /><span className="text-[11px] font-semibold text-white/90">{name}</span></div>
            <div className="text-base font-extrabold leading-tight text-white">{name}</div>
            <div className="text-[10px] text-white/70 line-clamp-2">{tagline}</div>
            <div className="mt-1 w-fit rounded px-3 py-1 text-[10px] font-bold" style={{ background: "var(--a)", color: "#111" }}>
              {t("preview.searchCta")}
            </div>
          </div>
          <div className="bg-white px-3 py-2"><Chips /></div>
        </div>
      )}
    </div>
  );
}
