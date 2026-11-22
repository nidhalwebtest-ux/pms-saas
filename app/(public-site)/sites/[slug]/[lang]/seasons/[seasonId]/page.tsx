import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { getSiteView } from "@/lib/public-site/render";
import { getPublicSeasons, searchAvailability } from "@/lib/public-site/data";
import { withBase } from "@/lib/public-site/lang";
import { pageMetadata } from "@/lib/public-site/seo";
import { breadcrumbLd } from "@/lib/public-site/schema-org";
import { formatDateYear, formatMoney } from "@/lib/public-site/format";
import JsonLd from "../../_components/JsonLd";
import SearchBar from "../../_components/SearchBar";
import UnitCard from "../../_components/UnitCard";
import { seasonName, seasonDescription } from "../../_sections/Seasons";

type Params = { slug: string; lang: string; seasonId: string };

export function generateStaticParams(): Params[] {
  return [];
}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang, seasonId } = await params;
  const v = await getSiteView(slug, lang);
  if (!v) return {};
  const season = (await getPublicSeasons(v.site.organizationId)).find((s) => s.id === seasonId);
  if (!season) return {};
  return pageMetadata(v, {
    title: seasonName(v, season),
    description: seasonDescription(v, season) || `${formatDateYear(season.startDate, v.lang)} – ${formatDateYear(season.endDate, v.lang)}`,
    path: `/seasons/${season.id}`,
  });
}

/**
 * A season landing page (e.g. Khareef 2026): dates, the operator's description, and the nightly
 * rate of every unit the season prices. Opt-in per season (Pricing → Seasons). Pre-rendered + cached.
 */
export default async function SeasonPage({ params }: { params: Promise<Params> }) {
  const { slug, lang: langParam, seasonId } = await params;
  const v = await getSiteView(slug, langParam);
  if (!v) notFound();
  const { site, lang, dict, theme, base } = v;

  const season = (await getPublicSeasons(site.organizationId)).find((s) => s.id === seasonId);
  if (!season) notFound(); // unknown, not published, or already over

  const name = seasonName(v, season);
  const desc = seasonDescription(v, season);

  // Rates: price one night inside the season (today if it's already running) and keep the units the season prices.
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const startMs = Math.max(new Date(season.startDate + "T00:00:00Z").getTime(), today.getTime());
  const night = new Date(startMs);
  const rated = (await searchAvailability(site.organizationId, { startDate: night, endDate: new Date(startMs + DAY) }))
    .filter((u) => u.priceName?.startsWith(season.name));

  // Search prefilled with a short stay at the season's start (never beyond its last night).
  const lastNight = new Date(season.endDate + "T00:00:00Z").getTime();
  const stayNights = Math.max(1, Math.min(season.minNights ?? 3, Math.round((lastNight - startMs) / DAY) + 1));
  const initial = { startDate: iso(night), endDate: iso(new Date(startMs + stayNights * DAY)) };

  const datesQs = `?startDate=${initial.startDate}&endDate=${initial.endDate}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <JsonLd
        data={breadcrumbLd(v, [
          { name: dict.nav.home, path: "/" },
          { name, path: `/seasons/${season.id}` },
        ])}
      />

      <header className={theme.key === "template_2" ? "text-center" : ""}>
        <span className="mb-3 block h-1 w-14 rounded-full" style={{ background: season.color, marginInline: theme.key === "template_2" ? "auto" : undefined }} />
        <p className={theme.eyebrow} style={{ color: "var(--site-accent)" }}>{dict.more.seasonsEyebrow}</p>
        <h1 className={`mt-2 font-[family-name:var(--font-display)] ${theme.pageTitle.replace("text-center", "")}`}>{name}</h1>
        <p className={`mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 ${theme.key === "template_2" ? "justify-center" : ""}`}>
          <CalendarDaysIcon className="h-4 w-4" />
          {formatDateYear(season.startDate, lang)} – {formatDateYear(season.endDate, lang)}
        </p>
        {desc && <p className={`mt-5 max-w-3xl whitespace-pre-line text-lg leading-relaxed text-slate-600 ${theme.key === "template_2" ? "mx-auto" : ""}`}>{desc}</p>}
      </header>

      <div className={`mt-8 border border-slate-100 bg-slate-50/70 p-4 ${theme.card.split(" ")[0]}`}>
        <p className="mb-3 text-sm font-semibold text-slate-700">{dict.more.seasonCheck}</p>
        <SearchBar initial={initial} />
      </div>

      <section className="mt-12">
        <h2 className={`mb-6 text-2xl font-semibold text-slate-900 font-[family-name:var(--font-display)] sm:text-3xl ${theme.key === "template_2" ? "text-center" : ""}`}>{dict.more.seasonStays}</h2>
        {rated.length === 0 ? (
          <p className="text-slate-500">{dict.more.seasonNoRates}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rated.map((u) => (
              <UnitCard
                key={u.id}
                v={v}
                unit={u}
                href={`${withBase(base, `/units/${u.id}`)}${datesQs}`}
                cta={dict.common.viewDetails}
                badge={name}
                priceMain={site.showPrices ? formatMoney(u.rateAmount, site.currency, lang) : null}
                priceSub={site.showPrices ? `${dict.common.from} · ${dict.common.perNight}` : null}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
