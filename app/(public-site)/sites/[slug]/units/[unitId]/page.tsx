import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckIcon, UserGroupIcon, HomeIcon } from "@heroicons/react/24/outline";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict, fill } from "@/lib/public-site/i18n";
import { getUnit, searchAvailability } from "@/lib/public-site/data";
import { formatMoney, formatDate } from "@/lib/public-site/format";
import SearchBar from "../../_components/SearchBar";

export const revalidate = 120;

type Params = { slug: string; unitId: string };
type Search = { startDate?: string; endDate?: string; guests?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, unitId } = await params;
  const site = await getCachedSite(slug);
  if (!site) return {};
  const u = await getUnit(site.organizationId, unitId);
  return { title: u?.name ?? "" };
}

export default async function UnitDetail({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug, unitId } = await params;
  const sp = await searchParams;
  const site = await getCachedSite(slug);
  if (!site) notFound();
  const lang = await resolveLang(site);
  const dict = getDict(lang);

  const unit = await getUnit(site.organizationId, unitId);
  if (!unit) notFound();

  const desc = (lang === "ar" ? unit.descriptionAr : unit.descriptionEn) || "";
  const amenities = lang === "ar" && unit.amenitiesAr.length ? unit.amenitiesAr : unit.amenities;
  const photos = unit.photos.slice(0, 5);

  // Optional live quote when the visitor arrived with dates.
  const startDate = sp.startDate, endDate = sp.endDate;
  const guests = sp.guests ? parseInt(sp.guests, 10) : undefined;
  let quote: { available: boolean; subtotal: number; nights: number; priceName: string | null; segments: { startDate: string; endDate: string; nights: number; ratePerNight: number; subtotal: number; priceName: string | null }[] } | null = null;

  if (startDate && endDate && new Date(endDate) > new Date(startDate)) {
    const results = await searchAvailability(site.organizationId, {
      buildingId: unit.buildingId, startDate: new Date(startDate), endDate: new Date(endDate), guests,
    });
    const m = results.find((r) => r.id === unit.id);
    quote = m
      ? { available: m.available, subtotal: m.subtotal, nights: m.nights, priceName: m.priceName, segments: m.segments }
      : { available: false, subtotal: 0, nights: 0, priceName: null, segments: [] };
  }

  const bookHref = `/book?unitId=${unit.id}&startDate=${startDate}&endDate=${endDate}&guests=${guests ?? 2}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Gallery */}
      {photos.length > 0 ? (
        <div className="grid gap-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:grid-rows-2" style={{ minHeight: 260 }}>
          {photos.map((src, i) => (
            <div key={i} className={`relative ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""} aspect-[4/3] sm:aspect-auto`}>
              <Image src={src} alt={unit.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-52 w-full rounded-2xl" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 16%, #fff), color-mix(in srgb, var(--site-accent) 22%, #fff))" }} />
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left: details */}
        <div>
          <Link href={`/buildings/${unit.buildingId}`} className="text-sm font-medium hover:underline" style={{ color: "var(--site-primary)" }}>
            {fill(dict.unit.inBuilding, { name: unit.buildingName })}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900 font-[family-name:var(--font-display)] sm:text-4xl">{unit.name}</h1>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><HomeIcon className="h-5 w-5 text-slate-400" /> {unit.bedrooms} {dict.common.bedrooms} · {unit.bathrooms} {dict.common.bathrooms}</span>
            {unit.maxGuests && <span className="inline-flex items-center gap-1.5"><UserGroupIcon className="h-5 w-5 text-slate-400" /> {dict.common.sleeps} {unit.maxGuests}</span>}
            {unit.area && <span>{unit.area} m²</span>}
          </div>

          {desc && <p className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-slate-600">{desc}</p>}

          {amenities.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-700">{dict.common.amenities}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <CheckIcon className="h-4 w-4" style={{ color: "var(--site-primary)" }} /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: pricing / booking */}
        <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">{dict.unit.pricing}</h2>
          <div className="mt-3">
            <SearchBar targetPath={`/units/${unit.id}`} initial={{ startDate, endDate, guests }} />
          </div>

          {!quote && site.showPrices && (
            <p className="mt-4 text-sm text-slate-500">
              <span className="text-lg font-extrabold text-slate-900">{formatMoney(unit.basePrice, site.currency, lang)}</span> {dict.common.perNight}
              <span className="mt-1 block text-xs text-slate-400">{dict.unit.selectDates}</span>
            </p>
          )}

          {quote && quote.available && (
            <div className="mt-4">
              {site.showPrices && (
                <ul className="space-y-1 border-b border-slate-100 pb-3 text-sm">
                  {quote.segments.map((s, i) => (
                    <li key={i} className="flex justify-between text-slate-600">
                      <span>{formatDate(s.startDate, lang)} – {formatDate(s.endDate, lang)}{s.priceName ? ` · ${s.priceName}` : ""}</span>
                      <span>{formatMoney(s.subtotal, site.currency, lang)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {site.showPrices && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{fill(dict.search.forNights, { n: quote.nights })}</span>
                  <span className="text-xl font-extrabold text-slate-900">{formatMoney(quote.subtotal, site.currency, lang)}</span>
                </div>
              )}
              <Link href={bookHref} className="mt-4 block rounded-xl py-3 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--site-primary)" }}>
                {dict.unit.requestThis}
              </Link>
            </div>
          )}

          {quote && !quote.available && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{dict.search.none}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
