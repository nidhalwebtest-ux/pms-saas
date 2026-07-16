import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict } from "@/lib/public-site/i18n";
import { getBuildings } from "@/lib/public-site/data";
import SearchBar from "./_components/SearchBar";
import BuildingCard from "./_components/BuildingCard";

export const revalidate = 120;

export default async function Home({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getCachedSite(slug);
  if (!site) notFound();
  const lang = await resolveLang(site);
  const dict = getDict(lang);
  const ar = lang === "ar";

  const name = (ar ? site.siteNameAr : site.siteNameEn) || site.orgName;
  const tagline = ar ? site.taglineAr : site.taglineEn;
  const about = ar ? site.aboutAr : site.aboutEn;
  const buildings = await getBuildings(site.organizationId);
  const heroPhoto = buildings.find((b) => b.photos[0])?.photos[0] ?? null;

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
          {heroPhoto ? (
            <Image src={heroPhoto} alt={name} fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "linear-gradient(150deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 70%, var(--site-primary)))" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/50" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-5xl md:text-6xl">{name}</h1>
            {tagline && <p className="mt-4 max-w-xl text-lg text-white/90 drop-shadow sm:text-xl">{tagline}</p>}
          </div>
        </div>

        {/* Search bar overlapping the hero */}
        <div className="mx-auto -mt-12 max-w-4xl px-4 sm:px-6">
          <SearchBar />
        </div>
      </section>

      {/* ── Khareef banner ── */}
      {site.khareefBannerEnabled && (
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          <div className="flex flex-col items-start gap-2 rounded-2xl p-6 text-white sm:flex-row sm:items-center sm:justify-between"
               style={{ background: "linear-gradient(120deg, var(--site-primary), var(--site-accent))" }}>
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-8 w-8 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">{dict.sections.khareefTitle}</h2>
                <p className="text-sm text-white/90">{dict.sections.khareefSubtitle}</p>
              </div>
            </div>
            <Link href="/buildings" className="rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white">
              {dict.sections.exploreStays}
            </Link>
          </div>
        </section>
      )}

      {/* ── Featured buildings ── */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900">{dict.sections.featured}</h2>
          <Link href="/buildings" className="text-sm font-semibold" style={{ color: "var(--site-primary)" }}>
            {dict.common.allStays} →
          </Link>
        </div>
        {buildings.length === 0 ? (
          <p className="text-slate-500">{dict.building.noUnits}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {buildings.slice(0, 6).map((b) => <BuildingCard key={b.id} building={b} />)}
          </div>
        )}
      </section>

      {/* ── About ── */}
      {about && (
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-bold text-slate-900">{dict.sections.about}</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{about}</p>
          </div>
        </section>
      )}
    </main>
  );
}
