import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { withBase } from "@/lib/public-site/lang";
import { fill } from "@/lib/public-site/i18n";
import Image from "../_components/Img";
import SearchBar from "../_components/SearchBar";
import BuildingList from "../_components/BuildingList";
import { DISPLAY, type HomeProps } from "./types";

/**
 * Template 3 — Modern: a dark split hero (type + search left, tall photo right), numbered
 * highlight cards, a bento grid of building tiles, a solid accent banner and a dark about band.
 */
export default function HomeModern({ v, buildings, name, tagline, about, location, heroPhoto, aboutPhoto, highlights }: HomeProps) {
  const { site, dict, theme, base } = v;
  const stays = withBase(base, "/buildings");
  const places = buildings.reduce((n, b) => n + b.unitCount, 0);

  return (
    <main>
      {/* ── Hero: split ── */}
      <section className="overflow-hidden bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-16">
          <div className="order-2 lg:order-1">
            <span className={theme.hero.kicker}>{location}</span>
            <h1 className={`${DISPLAY} ${theme.hero.title}`}>{name}</h1>
            {tagline && <p className={theme.hero.subtitle}>{tagline}</p>}
            <div className="mt-8">
              <SearchBar layout="grid" />
            </div>
            {places > 0 && (
              <p className="mt-5 text-sm font-medium text-white/60">
                <span className="me-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--site-accent)" }} />
                {fill(dict.sections.stayCount, { count: places })}
              </p>
            )}
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="absolute -inset-3 -z-0 hidden rounded-[28px] opacity-30 blur-2xl lg:block" style={{ background: "var(--site-accent)" }} />
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/15 lg:aspect-[4/5]">
              {heroPhoto ? (
                <Image src={heroPhoto} alt={name} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
              ) : (
                <div className="h-full w-full" style={{ background: "linear-gradient(150deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 60%, var(--site-primary)))" }} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights: numbered cards ── */}
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h, i) => (
            <div key={h.t} className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tabular-nums tracking-widest" style={{ color: "var(--site-primary)" }}>{String(i + 1).padStart(2, "0")}</span>
                <h.icon className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className={`${DISPLAY} mt-5 text-base font-bold tracking-tight text-slate-900`}>{h.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{h.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Khareef: solid accent banner ── */}
      {site.khareefBannerEnabled && (
        <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl p-8 sm:flex-row sm:items-center sm:p-10" style={{ background: "var(--site-accent)" }}>
            <div>
              <h2 className={`${DISPLAY} text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl`}>{dict.sections.khareefTitle}</h2>
              <p className="mt-2 max-w-md text-sm font-medium text-slate-950/70">{dict.sections.khareefSubtitle}</p>
            </div>
            <Link href={stays} className={`inline-flex shrink-0 items-center gap-2 bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 ${theme.btn}`}>
              {dict.sections.exploreStays}
              <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Featured stays: bento ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className={theme.eyebrow} style={{ color: "var(--site-primary)" }}>{dict.sections.featuredEyebrow}</p>
            <h2 className={`${DISPLAY} ${theme.sectionTitle}`}>{dict.sections.featured}</h2>
          </div>
          <Link href={stays} className="group hidden shrink-0 items-center gap-1.5 text-sm font-bold sm:inline-flex" style={{ color: "var(--site-primary)" }}>
            {dict.common.allStays}
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </div>
        {buildings.length === 0 ? <p className="text-slate-500">{dict.building.noUnits}</p> : <BuildingList v={v} buildings={buildings.slice(0, 6)} />}
      </section>

      {/* ── About: dark band ── */}
      {about && (
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
            <div>
              <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.sections.aboutEyebrow}</p>
              <h2 className={`${DISPLAY} mt-2 text-3xl font-bold tracking-tight sm:text-5xl`}>{dict.sections.about}</h2>
              <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-white/70">{about}</p>
            </div>
            {aboutPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-white/15">
                <Image src={aboutPhoto} alt={name} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
