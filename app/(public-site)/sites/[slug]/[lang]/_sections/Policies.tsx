import { ArrowRightEndOnRectangleIcon, ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import SectionHead from "./SectionHead";

/** Check-in/out times + free-text rules. Renders nothing when the operator hasn't entered any. */
export default function Policies({ v }: { v: SiteView }) {
  const { site, dict, lang, theme } = v;
  const text = (lang === "ar" ? site.policiesAr || site.policiesEn : site.policiesEn || site.policiesAr) ?? "";
  const hasTimes = !!site.checkInTime || !!site.checkOutTime;
  if (!text && !hasTimes) return null;

  const panel = `bg-white p-6 ring-1 ${theme.key === "template_2" ? "ring-stone-300" : "ring-slate-900/5"} ${theme.radius}`;
  const time = (label: string, value: string | null, Icon: typeof ArrowRightEndOnRectangleIcon) =>
    value && (
      <div className={`flex items-center gap-4 ${panel}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${theme.key === "template_2" ? "rounded-full" : theme.chip === "rounded-full" ? "rounded-xl" : theme.chip}`} style={{ background: "color-mix(in srgb, var(--site-primary) 10%, #fff)", color: "var(--site-primary)" }}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-xl font-bold tabular-nums text-slate-900" dir="ltr">{value}</p>
        </div>
      </div>
    );

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHead v={v} eyebrow={dict.more.policiesEyebrow} title={dict.more.policiesTitle} />
      <div className={`grid gap-5 ${text && hasTimes ? "lg:grid-cols-[320px_1fr]" : ""}`}>
        {hasTimes && (
          <div className="grid content-start gap-5">
            {time(dict.more.checkIn, site.checkInTime, ArrowRightEndOnRectangleIcon)}
            {time(dict.more.checkOut, site.checkOutTime, ArrowLeftStartOnRectangleIcon)}
          </div>
        )}
        {text && <div className={`whitespace-pre-line leading-relaxed text-slate-600 ${panel}`}>{text}</div>}
      </div>
    </section>
  );
}
