import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/public-site/sections";
import { withBase } from "@/lib/public-site/lang";
import { renderSections, sharedSections } from "../_sections";
import Image from "../_components/Img";
import SearchBar from "../_components/SearchBar";
import BuildingList from "../_components/BuildingList";
import { DISPLAY, type HomeProps } from "./types";

/** A hairline with a small diamond — the Classic section divider. */
function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-14" style={{ background: "var(--site-accent)" }} />
      <span className="h-1.5 w-1.5 rotate-45" style={{ background: "var(--site-accent)" }} />
      <span className="h-px w-14" style={{ background: "var(--site-accent)" }} />
    </div>
  );
}

/**
 * Template 2 — Classic (heritage hotel): ivory page, a framed photo hero with centred type and a
 * squared search card, thin-ruled highlights, editorial building rows, centred about.
 */
export default function HomeClassic({ v, buildings, name, tagline, about, location, heroPhoto, aboutPhoto, highlights }: HomeProps) {
  const { site, dict, theme, base } = v;
  const stays = withBase(base, "/buildings");

  const blocks: Partial<Record<SectionKey, ReactNode>> = {
    highlights: (
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {highlights.map((h, i) => (
            <div key={h.t} className={`flex flex-col items-center px-4 text-center ${i > 0 ? "lg:border-s lg:border-stone-300" : ""} ${i % 2 === 1 ? "max-lg:border-s max-lg:border-stone-300" : ""}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full ring-1" style={{ color: "var(--site-primary)", ["--tw-ring-color" as string]: "color-mix(in srgb, var(--site-accent) 70%, #fff)" }}>
                <h.icon className="h-5 w-5" />
              </span>
              <h3 className={`${DISPLAY} mt-4 text-lg text-stone-900`}>{h.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{h.d}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    khareef: site.khareefBannerEnabled && (
        <section className="mx-auto max-w-4xl px-5 pt-16 sm:px-8">
          <div className="border bg-white p-8 text-center" style={{ borderColor: "color-mix(in srgb, var(--site-accent) 60%, #fff)" }}>
            <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>Khareef</p>
            <h2 className={`${DISPLAY} mt-3 text-2xl text-stone-900 sm:text-3xl`}>{dict.sections.khareefTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">{dict.sections.khareefSubtitle}</p>
            <Link href={stays} className={`mt-6 inline-block px-7 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition hover:opacity-90 ${theme.btn}`} style={{ background: "var(--site-primary)" }}>
              {dict.sections.exploreStays}
            </Link>
          </div>
        </section>
      ),
    featured: (
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mb-12 text-center">
          <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.sections.featuredEyebrow}</p>
          <h2 className={`${DISPLAY} ${theme.sectionTitle}`}>{dict.sections.featured}</h2>
          <Ornament className="mt-5" />
        </div>
        {buildings.length === 0 ? <p className="text-center text-stone-500">{dict.building.noUnits}</p> : <BuildingList v={v} buildings={buildings.slice(0, 6)} />}
        {buildings.length > 1 && (
          <div className="mt-14 text-center">
            <Link href={stays} className="inline-block border border-[color:var(--site-primary)] px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[color:var(--site-primary)] transition hover:bg-[color:var(--site-primary)] hover:text-white">
              {dict.common.allStays}
            </Link>
          </div>
        )}
      </section>
    ),
    about: about && (
        <section className="border-y border-stone-300 bg-[#f3efe4]">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
            <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.sections.aboutEyebrow}</p>
            <h2 className={`${DISPLAY} ${theme.sectionTitle}`}>{dict.sections.about}</h2>
            <Ornament className="mt-5" />
            <p className="mt-8 whitespace-pre-line text-lg font-light leading-loose text-stone-600">{about}</p>
          </div>
          {aboutPhoto && (
            <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
              <div className="relative aspect-[16/7] overflow-hidden bg-white p-2 ring-1 ring-stone-300">
                <div className="relative h-full w-full overflow-hidden">
                  <Image src={aboutPhoto} alt={name} fill sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
                </div>
              </div>
            </div>
          )}
        </section>
      ),
    ...sharedSections(v, buildings),
  };

  return (
    <main>
      {/* ── Hero: photo inside a hairline frame ── */}
      <section className="px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="mx-auto max-w-6xl bg-white p-2 ring-1 ring-stone-300 sm:p-3">
          <div className={`relative ${theme.hero.height} w-full overflow-hidden`}>
            {heroPhoto ? (
              <Image src={heroPhoto} alt={name} fill priority sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: "linear-gradient(150deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 60%, var(--site-primary)))" }} />
            )}
            <div className={`absolute inset-0 ${theme.hero.overlay}`} />
            <div className={`absolute inset-0 flex flex-col px-5 pb-16 sm:px-8 ${theme.hero.align}`}>
              <span className={theme.hero.kicker}>{location}</span>
              <h1 className={`${DISPLAY} ${theme.hero.title}`}>{name}</h1>
              {tagline && <p className={theme.hero.subtitle}>{tagline}</p>}
            </div>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-10 max-w-4xl px-2 sm:px-6">
          <SearchBar />
        </div>
      </section>

      {renderSections(v, blocks)}
    </main>
  );
}
