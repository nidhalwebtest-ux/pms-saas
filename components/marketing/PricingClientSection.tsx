"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Check, Zap } from "lucide-react";
import Container from "./ui/Container";
import { MarketingButton } from "./ui/MarketingButton";
import {
  ANNUAL_DISCOUNT_PERCENT,
  PRICING_BANDS,
  formatBaisa,
  quoteBilling,
} from "@/lib/saas-pricing";

// The previous flat tiers (Starter / Growth / Ultimate) are preserved, hidden,
// in LegacyFlatTierPricingSection.tsx.

const MAX_SLIDER_UNITS = 200;

export default function PricingClientSection() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [units, setUnits] = useState(40);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const t = {
    badge: isAr ? "الأسعار" : "Pricing",
    title: isAr ? "تدفع فقط مقابل الوحدات التي تديرها" : "Pay only for the units you manage",
    sub: isAr
      ? "تسعير تصاعدي لكل وحدة: كلما زادت وحداتك انخفض سعر الوحدة. كل سعر يُطبَّق فقط على الوحدات ضمن شريحته."
      : "Banded per-unit pricing: the more units you manage, the lower your rate per unit. Each rate applies only to the units inside its band.",
    unitWord: isAr ? "وحدة" : "unit",
    unitsRange: (from: number, to: number | null) =>
      to === null
        ? isAr ? `من ${from} وما فوق` : `${from}+ units`
        : isAr ? `الوحدات ${from}–${to}` : `Units ${from}–${to}`,
    perUnit: isAr ? "ر.ع / وحدة / شهريًا" : "OMR / unit / month",
    calcTitle: isAr ? "احسب تكلفتك" : "Calculate your price",
    unitsLabel: isAr ? "عدد الوحدات" : "Number of units",
    monthly: isAr ? "شهري" : "Monthly",
    yearly: isAr ? "سنوي" : "Yearly",
    save: isAr ? `وفر ${ANNUAL_DISCOUNT_PERCENT}%` : `Save ${ANNUAL_DISCOUNT_PERCENT}%`,
    breakdown: isAr ? "تفصيل الحساب" : "Breakdown",
    omr: isAr ? "ر.ع" : "OMR",
    perMonth: isAr ? "/ شهريًا" : "/ month",
    perMonthBilledYearly: isAr ? "/ شهريًا (فوتِر سنويًا)" : "/ month, billed yearly",
    yearTotal: isAr ? "الإجمالي السنوي" : "Yearly total",
    youSave: isAr ? "توفّر" : "You save",
    cta: isAr ? "ابدأ الآن" : "Get started",
    features: isAr
      ? ["حجوزات ومستأجرون غير محدودين", "الفواتير والمدفوعات والمصروفات", "التقارير المالية", "العربية والإنجليزية"]
      : ["Unlimited reservations & tenants", "Invoices, payments & expenses", "Financial reports", "Arabic & English"],
  };

  const q = quoteBilling(units);
  const headline = cycle === "yearly" ? q.yearlyPerMonthBaisa : q.monthlyBaisa;

  const setClamped = (raw: string) => {
    const n = Math.floor(Number(raw));
    setUnits(Number.isFinite(n) ? Math.min(Math.max(n, 1), 10_000) : 1);
  };

  return (
    <section id="pricing" data-screen-label="Pricing" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container className="max-w-[1140px]">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            <Zap className="h-3.5 w-3.5" />
            <span>{t.badge}</span>
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">{t.title}</h2>
          <p className="mt-3 text-lg text-gray-600">{t.sub}</p>
        </div>

        {/* Bands */}
        <div className="grid gap-4 md:grid-cols-3">
          {PRICING_BANDS.map((b, i) => (
            <article
              key={b.from}
              className={`rounded-[20px] border p-6 text-center ${
                i === 1 ? "border-brand-500 bg-brand-50/50" : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-sm font-semibold text-gray-500">{t.unitsRange(b.from, b.to)}</p>
              <p className="mt-3 font-mono text-4xl font-extrabold tracking-tight text-gray-900" dir="ltr">
                {formatBaisa(b.rateBaisa)}
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-500">{t.perUnit}</p>
            </article>
          ))}
        </div>

        {/* Calculator */}
        <div className="mt-10 rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_10px_30px_-15px_rgba(15,39,64,0.12)] md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-xl font-bold text-gray-900">{t.calcTitle}</h3>
            <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50/80 p-1">
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    cycle === c ? "bg-brand-500 text-white shadow-md" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span>{c === "monthly" ? t.monthly : t.yearly}</span>
                  {c === "yearly" && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-gray-900">
                      {t.save}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <label htmlFor="pricing-units" className="text-sm font-semibold text-gray-700">
                {t.unitsLabel}
              </label>
              <div className="mt-3 flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={MAX_SLIDER_UNITS}
                  value={Math.min(units, MAX_SLIDER_UNITS)}
                  onChange={(e) => setClamped(e.target.value)}
                  aria-label={t.unitsLabel}
                  className="h-2 w-full cursor-pointer accent-brand-500"
                  dir="ltr"
                />
                <input
                  id="pricing-units"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={units}
                  onChange={(e) => setClamped(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg font-bold text-gray-900"
                  dir="ltr"
                />
              </div>

              <p className="mt-6 text-sm font-semibold text-gray-700">{t.breakdown}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
                {q.breakdown.map((r) => (
                  <li key={r.band.from} className="flex items-center justify-between gap-3" dir="ltr">
                    <span>
                      {r.units} × {formatBaisa(r.band.rateBaisa)}
                    </span>
                    <span className="font-mono font-semibold text-gray-900">{formatBaisa(r.subtotalBaisa)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-b from-brand-600 to-brand-800 p-6 text-white">
              <div>
                <p className="text-sm text-brand-100">
                  {units} {t.unitWord}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-5xl font-extrabold tracking-tight" dir="ltr">
                    {formatBaisa(headline)}
                  </span>
                  <span className="text-sm font-semibold text-brand-200">
                    {t.omr} {cycle === "yearly" ? t.perMonthBilledYearly : t.perMonth}
                  </span>
                </div>
                {cycle === "yearly" && (
                  <div className="mt-4 space-y-1 text-sm text-brand-100">
                    <p>
                      {t.yearTotal}:{" "}
                      <span className="font-mono font-bold text-white" dir="ltr">
                        {formatBaisa(q.yearlyBaisa)} {t.omr}
                      </span>
                    </p>
                    <p>
                      {t.youSave}:{" "}
                      <span className="font-mono font-bold text-white" dir="ltr">
                        {formatBaisa(q.yearlySavingsBaisa)} {t.omr}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <ul className="mt-6 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 flex-none" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <MarketingButton href="/login?mode=signup" variant="secondary" size="xl" fullWidth>
                  {t.cta}
                </MarketingButton>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
