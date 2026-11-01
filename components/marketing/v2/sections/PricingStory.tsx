"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Container from "../../ui/Container";
import { MarketingButton } from "../../ui/MarketingButton";
import { Reveal } from "../../ui/Reveal";
import { DuoIcon, type IconName } from "../icons";
import { GoldCheck } from "../GoldCheck";
import { gsap, useGSAP, prefersReducedMotion } from "../motion";
import { fmtNum } from "../scenes/useScene";
import { ANNUAL_DISCOUNT_PERCENT, FREE_UNITS, PRICING_BANDS, quoteBilling } from "@/lib/saas-pricing";
import { whatsappUrl } from "@/lib/marketing/whatsapp";
import s from "../landing.module.css";

/* Landing v2 · section 6 — pricing. A light "sheet" that rises over the dark story.
 * Source of truth: lib/saas-pricing.ts (first 5 units free for everyone, then banded per-unit rates,
 * 20% off yearly). Money is integer baisa, shown with 2 decimals on the landing page. */

const MAX_SLIDER_UNITS = 200;
const STEP_ICONS: IconName[] = ["userPlus", "buildings", "calendarCheck"];

/** A total that rolls to its new value whenever it changes (final value always in the DOM text). */
function RollingTotal({ baisa, className }: { baisa: number; className: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(baisa);
  useGSAP(
    () => {
      const node = el.current;
      if (!node) return;
      if (prefersReducedMotion()) { node.textContent = fmtNum(baisa); shown.current = baisa; return; }
      const o = { v: shown.current };
      gsap.to(o, {
        v: baisa,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => { node.textContent = fmtNum(o.v); shown.current = o.v; },
      });
    },
    { dependencies: [baisa] },
  );
  return <span ref={el} dir="ltr" className={className}>{fmtNum(baisa)}</span>;
}

export function PricingStory() {
  const t = useTranslations("marketing.pricing2");
  const tNav = useTranslations("marketing.nav");
  const [units, setUnits] = useState(40);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const q = quoteBilling(units);
  const headline = cycle === "yearly" ? q.yearlyPerMonthBaisa : q.monthlyBaisa;
  const isFree = q.monthlyBaisa === 0;
  const paidBands = PRICING_BANDS.filter((b) => b.rateBaisa > 0);
  const maxRate = Math.max(...paidBands.map((b) => b.rateBaisa));

  const setClamped = (raw: string) => {
    const n = Math.floor(Number(raw));
    setUnits(Number.isFinite(n) ? Math.min(Math.max(n, 1), 10_000) : 1);
  };
  const range = (from: number, to: number | null) => (to === null ? t("unitsFrom", { from }) : t("unitsRange", { from, to }));

  return (
    <section
      id="pricing"
      data-screen-label="Pricing"
      className="relative z-[1] -mt-12 scroll-mt-16 rounded-t-[32px] bg-white pb-20 pt-16 shadow-[0_-18px_50px_-12px_rgba(11,31,58,.35)] md:-mt-20 md:rounded-t-[56px] md:pb-28 md:pt-24"
    >
      <Container wide>
        <div className="mx-auto max-w-[760px] text-center">
          <span className="inline-flex items-center rounded-full border border-brand-500/15 bg-brand-50 px-3.5 py-1 text-[14px] font-semibold text-brand-700">
            {t("eyebrow")}
          </span>
          <h2 className="mt-4 text-[32px] font-bold leading-[1.25] text-[#0B1F3A] md:text-[46px]">{t("title")}</h2>
          <p className="mt-4 text-[17px] leading-[1.7] text-gray-600 md:text-[19px]">{t("sub")}</p>
        </div>

        {/* bands: the free allowance first, then the per-unit rates stepping down */}
        <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal as="li">
            <article className="flex h-full flex-col rounded-[22px] border-2 border-brand-500 bg-brand-50/60 p-6">
              <span className="text-[14px] font-semibold text-brand-700">{range(1, FREE_UNITS)}</span>
              <p className="mt-3 text-[30px] font-bold leading-tight text-[#0B1F3A]">{t("freeTitle")}</p>
              <p className="mt-2 text-[16px] text-gray-600">{t("freeDesc")}</p>
            </article>
          </Reveal>
          {paidBands.map((b, i) => (
            <Reveal as="li" key={b.from} delay={(i + 1) * 90}>
              <article className="flex h-full flex-col rounded-[22px] border border-gray-200 bg-white p-6">
                <span className="text-[14px] font-semibold text-gray-500">{range(b.from, b.to)}</span>
                <p dir="ltr" className="mt-3 text-[36px] font-bold leading-tight tracking-[-0.01em] text-[#0B1F3A] rtl:text-right">
                  {fmtNum(b.rateBaisa)}
                </p>
                <p className="mt-1 text-[14px] text-gray-500">{t("perUnit")}</p>
                {/* the rate as a bar, so "it gets cheaper as you grow" reads at a glance */}
                <div className="mt-auto pt-5" aria-hidden="true">
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(b.rateBaisa / maxRate) * 100}%` }} />
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>

        {/* calculator */}
        <div className="mt-10 grid gap-6 rounded-[28px] border border-gray-200 bg-gray-50/70 p-5 md:p-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-[22px] font-bold text-[#0B1F3A]">{t("calcTitle")}</h3>
              <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1" role="group">
                {(["monthly", "yearly"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cycle === c}
                    onClick={() => setCycle(c)}
                    className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-bold transition-colors ${
                      cycle === c ? "bg-[#0B1F3A] text-white" : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {c === "monthly" ? t("monthly") : t("yearly")}
                    {c === "yearly" && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cycle === c ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700"}`}>
                        {t("save", { pct: ANNUAL_DISCOUNT_PERCENT })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="pricing-units" className="mt-7 block text-[15px] font-semibold text-gray-700">{t("unitsLabel")}</label>
            <div className="mt-3 flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={MAX_SLIDER_UNITS}
                value={Math.min(units, MAX_SLIDER_UNITS)}
                onChange={(e) => setClamped(e.target.value)}
                aria-label={t("unitsLabel")}
                className="h-2 w-full cursor-pointer accent-[#185FA5]"
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
                className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-[18px] font-bold text-gray-900"
                dir="ltr"
              />
            </div>

            <p className="mt-7 text-[15px] font-semibold text-gray-700">{t("breakdown")}</p>
            <ul className="mt-2 list-none space-y-2 p-0 text-[15px] text-gray-600">
              {q.breakdown.map((r) => (
                <li key={r.band.from} className="flex items-center justify-between gap-3">
                  <span>
                    {r.band.rateBaisa === 0 ? (
                      <>
                        <bdi dir="ltr">{r.units}</bdi> {t("freeUnits")}
                      </>
                    ) : (
                      <bdi dir="ltr">{r.units} × {fmtNum(r.band.rateBaisa)}</bdi>
                    )}
                  </span>
                  <span dir="ltr" className="font-semibold text-gray-900">
                    {r.band.rateBaisa === 0 ? t("free") : fmtNum(r.subtotalBaisa)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* result: navy panel, the total in gold (a number) */}
          <div className={`${s.root} ${s.story} flex flex-col justify-between rounded-[22px] p-6 md:p-7`}>
            <div>
              <p className="text-[15px] text-white/75">
                <bdi dir="ltr">{units}</bdi> {t("unitWord")}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {isFree ? (
                  <span className={`${s.goldNum} text-[52px] font-bold leading-none`}>{t("free")}</span>
                ) : (
                  <RollingTotal baisa={headline} className={`${s.goldNum} text-[52px] font-bold leading-none`} />
                )}
                {!isFree && (
                  <span className="text-[15px] font-semibold text-white/75">
                    {t("omr")} {cycle === "yearly" ? t("perMonthYearly") : t("perMonth")}
                  </span>
                )}
              </div>
              {cycle === "yearly" && !isFree && (
                <div className="mt-4 space-y-1 text-[15px] text-white/75">
                  <p>{t("yearTotal")}: <bdi dir="ltr" className="font-bold text-white">{fmtNum(q.yearlyBaisa)} {t("omr")}</bdi></p>
                  <p>{t("youSave")}: <bdi dir="ltr" className="font-bold text-white">{fmtNum(q.yearlySavingsBaisa)} {t("omr")}</bdi></p>
                </div>
              )}
              <ul className="mt-6 list-none space-y-2.5 p-0">
                {(t.raw("features") as string[]).map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[15.5px]">
                    <GoldCheck size={20} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <a
                href={whatsappUrl(tNav("whatsappText"))}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="pricing-whatsapp"
                className={`${s.ctaGold} inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-[16px] font-bold`}
              >
                <DuoIcon name="whatsappLogo" size={22} duo="#0B1F3A" duoOpacity={0.18} />
                {t("ctaWhatsapp")}
              </a>
              {/* MarketingButton renders inside a Link, so the wrapper takes the flex share */}
              <div className="flex-1">
                <MarketingButton href="/login?mode=signup" variant="secondary" size="lg" fullWidth>
                  {t("ctaSignup")}
                </MarketingButton>
              </div>
            </div>
          </div>
        </div>

        {/* start in 3 steps (replaces the separate "how it works" section) */}
        <h3 className="mt-16 text-center text-[24px] font-bold text-[#0B1F3A] md:text-[30px]">{t("stepsTitle")}</h3>
        <ol className="mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
          {(t.raw("steps") as { t: string; d: string }[]).map((st, i) => (
            <Reveal as="li" key={st.t} delay={i * 100}>
              <div className="flex h-full gap-4 rounded-[22px] border border-gray-200 bg-white p-6">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <DuoIcon name={STEP_ICONS[i]} size={26} duo="#85B7EB" />
                </span>
                <div>
                  <p className="text-[18px] font-bold text-[#0B1F3A]">
                    <bdi dir="ltr" className="text-brand-500">{i + 1}</bdi> · {st.t}
                  </p>
                  <p className="mt-1.5 text-[15.5px] leading-[1.6] text-gray-600">{st.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
