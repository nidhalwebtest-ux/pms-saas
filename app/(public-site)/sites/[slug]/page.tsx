import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SparklesIcon, MapPinIcon, ChatBubbleLeftRightIcon, TagIcon, HeartIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict, fill } from "@/lib/public-site/i18n";
import { getBuildings } from "@/lib/public-site/data";
import SearchBar from "./_components/SearchBar";
import BuildingCard from "./_components/BuildingCard";

export const revalidate = 120;
const DISPLAY = "font-[family-name:var(--font-display)]";

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
  const location = (ar ? site.addressAr : site.addressEn) || (ar ? "صلالة، عُمان" : "Salalah, Oman");
  const buildings = await getBuildings(site.organizationId);
  const heroPhoto = buildings.find((b) => b.photos[0])?.photos[0] ?? null;
  const aboutPhoto = buildings.find((b) => b.photos[1])?.photos[1] ?? heroPhoto;

  const highlights = [
    { icon: MapPinIcon, ...dict.highlights.location },
    { icon: ChatBubbleLeftRightIcon, ...dict.highlights.booking },
    { icon: TagIcon, ...dict.highlights.price },
    { icon: HeartIcon, ...dict.highlights.care },
  ];

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative h-[86vh] min-h-[560px] w-full overflow-hidden">
          {heroPhoto ? (
            <Image src={heroPhoto} alt={name} fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: "linear-gradient(150deg, var(--site-primary), color-mix(in srgb, var(--site-accent) 60%, var(--site-primary)))" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />

          <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col items-start justify-center px-5 sm:px-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-white ring-1 ring-white/25 backdrop-blur-sm">
              <MapPinIcon className="h-3.5 w-3.5" /> {location}
            </span>
            <h1 className={`${DISPLAY} mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-white drop-shadow-sm sm:text-6xl md:text-7xl`}>{name}</h1>
            {tagline && <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-white/90 sm:text-xl">{tagline}</p>}
          </div>
        </div>

        {/* Search bar */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:-mt-14 -mt-8 relative z-10">
          <SearchBar />
        </div>
      </section>

      {/* ── Highlights ── */}
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

      {/* ── Khareef banner ── */}
      {site.khareefBannerEnabled && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <div className="relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl p-8 text-white sm:flex-row sm:items-center sm:justify-between"
               style={{ background: "linear-gradient(120deg, var(--site-primary), var(--site-accent))" }}>
            <div className="relative flex items-center gap-4">
              <SparklesIcon className="h-9 w-9 flex-shrink-0" />
              <div>
                <h2 className={`${DISPLAY} text-2xl font-semibold`}>{dict.sections.khareefTitle}</h2>
                <p className="mt-1 text-sm text-white/90">{dict.sections.khareefSubtitle}</p>
              </div>
            </div>
            <Link href="/buildings" className="relative shrink-0 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90">
              {dict.sections.exploreStays}
            </Link>
          </div>
        </section>
      )}

      {/* ── Featured stays ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--site-accent)" }}>{dict.sections.featuredEyebrow}</p>
            <h2 className={`${DISPLAY} mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl`}>{dict.sections.featured}</h2>
          </div>
          <Link href="/buildings" className="group hidden shrink-0 items-center gap-1.5 text-sm font-semibold sm:inline-flex" style={{ color: "var(--site-primary)" }}>
            {dict.common.allStays}
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
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
        <section className="border-t border-slate-100 bg-stone-50/70">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--site-accent)" }}>{dict.sections.aboutEyebrow}</p>
              <h2 className={`${DISPLAY} mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl`}>{dict.sections.about}</h2>
              <p className="mt-5 whitespace-pre-line text-lg font-light leading-relaxed text-slate-600">{about}</p>
            </div>
            {aboutPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5">
                <Image src={aboutPhoto} alt={name} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
