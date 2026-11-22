import { notFound } from "next/navigation";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { getSiteView } from "@/lib/public-site/render";
import type { Metadata } from "next";
import { fill } from "@/lib/public-site/i18n";
import { pageMetadata } from "@/lib/public-site/seo";
import { withBase } from "@/lib/public-site/lang";
import { searchAvailability } from "@/lib/public-site/data";
import { formatMoney, formatDate } from "@/lib/public-site/format";
import SearchBar from "../_components/SearchBar";
import UnitCard from "../_components/UnitCard";

export const dynamic = "force-dynamic"; // results depend on live availability

type Params = { slug: string; lang: string };

/** Result/booking pages depend on the visitor's dates — keep them out of search results. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, lang } = await params;
  const v = await getSiteView(slug, lang);
  return v ? pageMetadata(v, { title: v.dict.search.title, path: "/search", noindex: true }) : {};
}
type Search = { startDate?: string; endDate?: string; guests?: string; buildingId?: string };

export default async function SearchResults({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug, lang: langParam } = await params;
  const sp = await searchParams;
  const v = await getSiteView(slug, langParam);
  if (!v) notFound();
  const { site, lang, dict, base } = v;

  const { startDate, endDate } = sp;
  const guests = sp.guests ? parseInt(sp.guests, 10) : undefined;
  const valid = !!startDate && !!endDate && new Date(endDate) > new Date(startDate);

  const results = valid
    ? await searchAvailability(site.organizationId, {
        buildingId: sp.buildingId, startDate: new Date(startDate!), endDate: new Date(endDate!), guests,
      })
    : [];
  const available = results.filter((r) => r.available);
  // free units that are only blocked by the minimum stay → tell the guest why
  const shortest = results.filter((r) => r.tooShort).reduce<number | null>((m, r) => (m === null ? r.minNights : Math.min(m, r.minNights)), null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className={`font-[family-name:var(--font-display)] ${v.theme.pageTitle.replace("text-center", "")}`}>{dict.search.title}</h1>
      {valid && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
          <CalendarDaysIcon className="h-4 w-4" />
          {formatDate(startDate!, lang)} → {formatDate(endDate!, lang)} · {guests ?? 2} {dict.hero.guestsPlural}
        </p>
      )}

      <div className={`mt-4 border border-slate-100 bg-slate-50/70 p-4 ${v.theme.card.split(" ")[0]}`}>
        <SearchBar buildingId={sp.buildingId} initial={{ startDate, endDate, guests }} />
      </div>

      {!valid ? (
        <p className="mt-10 text-slate-500">{dict.search.pickDates}</p>
      ) : available.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-semibold text-slate-700">{dict.search.none}</p>
          <p className="mt-1 text-slate-500">{shortest !== null ? fill(dict.search.minStay, { n: shortest }) : dict.search.tryOther}</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm font-medium text-slate-500">{fill(dict.search.resultsFor, { count: available.length })}</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((u) => (
              <UnitCard
                key={u.id}
                v={v}
                unit={u}
                href={`${withBase(base, "/book")}?unitId=${u.id}&startDate=${startDate}&endDate=${endDate}&guests=${guests ?? 2}`}
                cta={dict.search.request}
                badge={u.priceName}
                priceMain={site.showPrices ? formatMoney(u.total, site.currency, lang) : null}
                priceSub={site.showPrices ? `${fill(dict.search.forNights, { n: u.nights })}${u.discountPercent ? ` · −${u.discountPercent}%` : ""}` : null}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
