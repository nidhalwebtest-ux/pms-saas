"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSite } from "@/lib/public-site/context";
import { fill } from "@/lib/public-site/i18n";
import { formatMoney, formatDate } from "@/lib/public-site/format";
import { withBase } from "@/lib/public-site/lang";
import SearchBar from "../../_components/SearchBar";

type Segment = { startDate: string; endDate: string; nights: number; subtotal: number; priceName: string | null };
type Quote = {
  available: boolean; tooShort: boolean; minNights: number; nights: number;
  discount: number | null; discountPercent: number | null; total: number | null; segments: Segment[];
};

/**
 * Pricing box on the unit page. The page itself is pre-rendered and cached; the
 * live quote for the visitor's dates is fetched here from /api/public/availability
 * (same engine as the PMS), so prices and availability are always current.
 */
function QuoteInner({ unitId, buildingId, basePrice }: { unitId: string; buildingId: string; basePrice: number }) {
  const { dict, lang, base, currency, showPrices } = useSite();
  const sp = useSearchParams();
  const startDate = sp.get("startDate") ?? undefined;
  const endDate = sp.get("endDate") ?? undefined;
  const guestsRaw = parseInt(sp.get("guests") ?? "", 10);
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? guestsRaw : undefined;
  const hasDates = !!startDate && !!endDate && endDate > startDate;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasDates) { setQuote(null); return; }
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ startDate: startDate!, endDate: endDate!, buildingId });
    if (guests) qs.set("guests", String(guests));
    setLoading(true); setFailed(false);
    fetch(`/api/public/availability?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { units: (Quote & { id: string })[] }) => {
        const m = data.units.find((u) => u.id === unitId);
        setQuote(m ?? { available: false, tooShort: false, minNights: 1, nights: 0, discount: 0, discountPercent: null, total: 0, segments: [] });
      })
      .catch((e) => { if (!ctrl.signal.aborted) { setFailed(true); setQuote(null); } void e; })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [hasDates, startDate, endDate, guests, buildingId, unitId]);

  const bookHref = `${withBase(base, "/book")}?unitId=${unitId}&startDate=${startDate}&endDate=${endDate}&guests=${guests ?? 2}`;

  return (
    <>
      <div className="mt-3">
        <SearchBar stacked targetPath={`/units/${unitId}`} initial={{ startDate, endDate, guests }} />
      </div>

      {!hasDates && showPrices && (
        <p className="mt-4 text-sm text-slate-500">
          <span className="text-lg font-extrabold text-slate-900">{formatMoney(basePrice, currency, lang)}</span> {dict.common.perNight}
          <span className="mt-1 block text-xs text-slate-400">{dict.unit.selectDates}</span>
        </p>
      )}

      {hasDates && loading && (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label={dict.common.loading}>
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {hasDates && !loading && failed && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{dict.booking.failed}</p>
      )}

      {hasDates && !loading && quote && quote.available && (
        <div className="mt-4">
          {showPrices && quote.total !== null && (
            <>
              <ul className="space-y-1 border-b border-slate-100 pb-3 text-sm">
                {quote.segments.map((s, i) => (
                  <li key={i} className="flex justify-between gap-3 text-slate-600">
                    <span>{formatDate(s.startDate, lang)} – {formatDate(s.endDate, lang)}{s.priceName ? ` · ${s.priceName}` : ""}</span>
                    <span className="shrink-0">{formatMoney(s.subtotal, currency, lang)}</span>
                  </li>
                ))}
                {!!quote.discount && quote.discount > 0 && (
                  <li className="flex justify-between font-medium text-emerald-700">
                    <span>{fill(dict.search.longStay, { percent: quote.discountPercent ?? 0 })}</span>
                    <span>−{formatMoney(quote.discount, currency, lang)}</span>
                  </li>
                )}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">{fill(dict.search.forNights, { n: quote.nights })}</span>
                <span className="text-xl font-extrabold text-slate-900">{formatMoney(quote.total, currency, lang)}</span>
              </div>
            </>
          )}
          <Link href={bookHref} className="mt-4 block rounded-xl py-3 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-90" style={{ background: "var(--site-primary)" }}>
            {dict.unit.requestThis}
          </Link>
        </div>
      )}

      {hasDates && !loading && quote && !quote.available && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {quote.tooShort ? fill(dict.search.minStay, { n: quote.minNights }) : dict.search.none}
        </p>
      )}
    </>
  );
}

/** Shown in the pre-rendered HTML until the browser reads the URL's dates. */
function QuoteFallback({ basePrice }: { basePrice: number }) {
  const { dict, lang, currency, showPrices } = useSite();
  return (
    <>
      <div className="mt-3 h-[232px] animate-pulse rounded-2xl bg-slate-50" />
      {showPrices && (
        <p className="mt-4 text-sm text-slate-500">
          <span className="text-lg font-extrabold text-slate-900">{formatMoney(basePrice, currency, lang)}</span> {dict.common.perNight}
        </p>
      )}
    </>
  );
}

export default function UnitQuote(props: { unitId: string; buildingId: string; basePrice: number }) {
  return (
    <Suspense fallback={<QuoteFallback basePrice={props.basePrice} />}>
      <QuoteInner {...props} />
    </Suspense>
  );
}
