import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDaysIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { getCachedSite, resolveLang } from "@/lib/public-site/render";
import { getDict, fill } from "@/lib/public-site/i18n";
import { getUnit, searchAvailability } from "@/lib/public-site/data";
import { formatMoney, formatDate } from "@/lib/public-site/format";
import BookingForm from "./BookingForm";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type Search = { unitId?: string; startDate?: string; endDate?: string; guests?: string };

export default async function BookPage({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const site = await getCachedSite(slug);
  if (!site) notFound();
  const lang = await resolveLang(site);
  const dict = getDict(lang);

  const { unitId, startDate, endDate } = sp;
  const guests = sp.guests ? parseInt(sp.guests, 10) : 2;
  const valid = !!unitId && !!startDate && !!endDate && new Date(endDate) > new Date(startDate);
  if (!valid) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-slate-500">{dict.search.pickDates}</p>
        <Link href="/buildings" className="mt-4 inline-block font-semibold" style={{ color: "var(--site-primary)" }}>{dict.common.allStays} →</Link>
      </main>
    );
  }

  const unit = await getUnit(site.organizationId, unitId!);
  if (!unit) notFound();

  const results = await searchAvailability(site.organizationId, {
    buildingId: unit.buildingId, startDate: new Date(startDate!), endDate: new Date(endDate!), guests,
  });
  const quote = results.find((r) => r.id === unit.id);
  const available = quote?.available ?? false;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">{dict.booking.title}</h1>

      {!available ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-800">{dict.search.none}</p>
          <Link href={`/units/${unit.id}`} className="mt-2 inline-block text-sm font-medium text-amber-700 underline">{dict.search.editSearch}</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
          {/* Recap */}
          <div className="h-fit rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-500">{dict.booking.recap}</h2>
            <p className="mt-2 text-lg font-bold text-slate-900">{unit.name}</p>
            <p className="text-sm text-slate-500">{unit.buildingName}</p>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p className="inline-flex items-center gap-2"><CalendarDaysIcon className="h-4 w-4" /> {formatDate(startDate!, lang)} → {formatDate(endDate!, lang)}</p>
              <p className="inline-flex items-center gap-2"><UserGroupIcon className="h-4 w-4" /> {guests} {dict.hero.guestsPlural}</p>
            </div>

            {site.showPrices && quote && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ul className="space-y-1 text-sm">
                  {quote.segments.map((s, i) => (
                    <li key={i} className="flex justify-between text-slate-600">
                      <span>{formatDate(s.startDate, lang)} – {formatDate(s.endDate, lang)}{s.priceName ? ` · ${s.priceName}` : ""}</span>
                      <span>{formatMoney(s.subtotal, site.currency, lang)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-medium text-slate-500">{dict.common.total} · {fill(dict.search.forNights, { n: quote.nights })}</span>
                  <span className="text-xl font-extrabold text-slate-900">{formatMoney(quote.subtotal, site.currency, lang)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Guest details */}
          <BookingForm unitId={unit.id} unitName={unit.name} startDate={startDate!} endDate={endDate!} guests={guests} />
        </div>
      )}
    </main>
  );
}
