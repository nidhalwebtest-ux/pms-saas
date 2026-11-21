import Link from "next/link";
import { SparklesIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/public-site/sections";
import { withBase } from "@/lib/public-site/lang";
import { renderSections, sharedSections } from "../_sections";
import Image from "../_components/Img";
import SearchBar from "../_components/SearchBar";
import BuildingList from "../_components/BuildingList";
import { DISPLAY, type HomeProps } from "./types";

/** Template 1 — Coastal: full-bleed photo hero with an overlapping search bar, airy sections. */
export default function HomeCoastal({ v, buildings, name, tagline, about, location, heroPhoto, aboutPhoto, highlights }: HomeProps) {
  const { site, dict, theme, base } = v;
  const stays = withBase(base, "/buildings");

  const blocks: Partial<Record<SectionKey, ReactNode>> = {
    highlights: (
      <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.t} className="flex flex-col gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--site-primary) 10%, #fff)", color: "var(--site-primary)" }}>
                <h.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{h.t}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{h.d}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    khareef: site.khareefBannerEnabled && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <div className="relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl p-8 text-white sm:flex-row sm:items-center sm:justify-between" style={{ background: "linear-gradient(120deg, var(--site-primary), var(--site-accent))" }}>
            <div className="relative flex items-center gap-4">
              <SparklesIcon className="h-9 w-9 flex-shrink-0" />
              <div>
                <h2 className={`${DISPLAY} text-2xl font-semibold`}>{dict.sections.khareefTitle}</h2>
                <p className="mt-1 text-sm text-white/90">{dict.sections.khareefSubtitle}</p>
              </div>
            </div>
            <Link href={stays} className={`relative shrink-0 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 ${theme.btn}`}>
              {dict.sections.exploreStays}
            </Link>
          </div>
        </section>
      ),
    featured: (
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.sections.featuredEyebrow}</p>
            <h2 className={`${DISPLAY} ${theme.sectionTitle}`}>{dict.sections.featured}</h2>
          </div>
          <Link href={stays} className="group hidden shrink-0 items-center gap-1.5 text-sm font-semibold sm:inline-flex" style={{ color: "var(--site-primary)" }}>
            {dict.common.allStays}
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </div>
        {buildings.length === 0 ? <p className="text-slate-500">{dict.building.noUnits}</p> : <BuildingList v={v} buildings={buildings.slice(0, 6)} />}
      </section>
    ),
    about: about && (
        <section className="border-t border-black/5 bg-black/[0.015]">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
            <div>
              <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.sections.aboutEyebrow}</p>
              <h2 className={`${DISPLAY} ${theme.sectionTitle}`}>{dict.sections.about}</h2>
              <p className="mt-5 whitespace-pre-line text-lg font-light leading-relaxed text-slate-600">{about}</p>
            </div>
            {aboutPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5">
                <Image src={aboutPhoto} alt={name} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      ),
    ...sharedSections(v, buildings),
  };

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative">
        <div className={`relative ${theme.hero.height} w-full overflow-hidden`}>
          {heroPhoto ? (
            <Image src={heroPhoto} alt={name} fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "linear-gradient(150deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 60%, var(--site-primary)))" }} />
          )}
          <div className={`absolute inset-0 ${theme.hero.overlay}`} />
          <div className={`absolute inset-0 mx-auto flex max-w-6xl flex-col px-5 sm:px-8 ${theme.hero.align}`}>
            <span className={theme.hero.kicker}>{location}</span>
            <h1 className={`${DISPLAY} ${theme.hero.title}`}>{name}</h1>
            {tagline && <p className={theme.hero.subtitle}>{tagline}</p>}
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-8 max-w-5xl px-4 sm:px-6 lg:-mt-14">
          <SearchBar />
        </div>
      </section>

      {renderSections(v, blocks)}
    </main>
  );
}
