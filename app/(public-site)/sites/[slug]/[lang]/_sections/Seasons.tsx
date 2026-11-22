import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { SiteView } from "@/lib/public-site/render";
import type { PublicSeason } from "@/lib/public-site/data";
import { withBase } from "@/lib/public-site/lang";
import { formatDateYear } from "@/lib/public-site/format";
import SectionHead from "./SectionHead";

export const seasonName = (v: SiteView, s: PublicSeason) => (v.lang === "ar" ? s.nameAr || s.name : s.name);
export const seasonDescription = (v: SiteView, s: PublicSeason) => (v.lang === "ar" ? s.descriptionAr || s.descriptionEn : s.descriptionEn || s.descriptionAr) ?? "";

/** Cards linking to the opt-in season landing pages. Renders nothing when there are none. */
export default function Seasons({ v, seasons }: { v: SiteView; seasons: PublicSeason[] }) {
  if (seasons.length === 0) return null;
  const { dict, lang, theme, base } = v;
  const cols = seasons.length === 1 ? "max-w-xl" : seasons.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <SectionHead v={v} eyebrow={dict.more.seasonsEyebrow} title={dict.more.seasonsTitle} />
      <div className={`grid gap-5 ${theme.key === "template_2" || seasons.length === 1 ? "mx-auto" : ""} ${cols}`}>
        {seasons.slice(0, 6).map((s) => {
          const desc = seasonDescription(v, s);
          return (
            <Link
              key={s.id}
              href={withBase(base, `/seasons/${s.id}`)}
              className={`group relative flex flex-col overflow-hidden bg-white p-6 transition duration-300 ${theme.card}`}
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <CalendarDaysIcon className="h-4 w-4" />
                {formatDateYear(s.startDate, lang)} – {formatDateYear(s.endDate, lang)}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900 font-[family-name:var(--font-display)]">{seasonName(v, s)}</h3>
              {desc && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{desc}</p>}
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
                {dict.more.seasonCta}
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
