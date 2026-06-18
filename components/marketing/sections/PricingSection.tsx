import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

export default async function PricingSection() {
  const t = await getTranslations("marketing.pricing");

  type Tier = {
    name: string;
    tagline: string;
    amount: string;
    per: string;
    cta: string;
    ctaVariant: "primary" | "secondary";
    featured?: boolean;
    badge?: string;
    sectionLabel?: string;
    features: string[];
  };

  const TIERS: Tier[] = [
    {
      name:    t("freeName"),
      tagline: t("freeTagline"),
      amount:  "0",
      per:     t("perForever"),
      cta:     t("freeCta"),
      ctaVariant: "secondary",
      features: [t("freeF1"), t("freeF2"), t("freeF3"), t("freeF4"), t("freeF5"), t("freeF6")],
    },
    {
      name:    t("proName"),
      tagline: t("proTagline"),
      amount:  "25",
      per:     t("perMonth"),
      cta:     t("proCta"),
      ctaVariant: "primary",
      featured: true,
      badge:   t("badgePopular"),
      sectionLabel: t("featuresHeader", { tier: t("freeName") }),
      features: [t("proF1"), t("proF2"), t("proF3"), t("proF4"), t("proF5"), t("proF6")],
    },
    {
      name:    t("bizName"),
      tagline: t("bizTagline"),
      amount:  "75",
      per:     t("perMonth"),
      cta:     t("bizCta"),
      ctaVariant: "secondary",
      sectionLabel: t("featuresHeader", { tier: t("proName") }),
      features: [t("bizF1"), t("bizF2"), t("bizF3"), t("bizF4"), t("bizF5"), t("bizF6")],
    },
  ];

  return (
    <section id="pricing" data-screen-label="Pricing" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid items-stretch gap-5 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 100}>
              <article
                className={[
                  "relative flex h-full flex-col rounded-lg border bg-white p-8 transition-all duration-300",
                  tier.featured
                    ? "border-brand-500 shadow-[0_0_0_1px_var(--brand-500),0_12px_32px_-12px_oklch(0.46_0.17_258/0.3)] md:-translate-y-2 bg-gradient-to-b from-white to-[oklch(0.99_0.005_258)] hover:-translate-y-3 hover:shadow-2xl"
                    : "border-gray-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg",
                ].join(" ")}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-white">
                    {tier.badge}
                  </span>
                )}
                <div className="mb-1.5 text-[15px] font-semibold text-gray-900">{tier.name}</div>
                <p className="m-0 mb-6 text-sm text-gray-600">{tier.tagline}</p>
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums ltr-num">
                    {tier.amount}
                  </span>
                  <span className="font-mono text-sm uppercase text-gray-500">OMR</span>
                  <span className="text-sm text-gray-500">{tier.per}</span>
                </div>
                <div className="mt-5 mb-6">
                  <MarketingButton href="/login?mode=signup" variant={tier.ctaVariant} size="lg" fullWidth>
                    {tier.cta}
                  </MarketingButton>
                </div>
                <ul className="m-0 grid list-none gap-2.5 p-0">
                  {tier.sectionLabel && (
                    <li className="mt-2 border-t border-gray-200 pt-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-500">
                      {tier.sectionLabel}
                    </li>
                  )}
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <span className="mt-px grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full bg-success-50 text-[12px] font-bold text-success-700">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
