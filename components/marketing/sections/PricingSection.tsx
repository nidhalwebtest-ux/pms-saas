import Container, { SectionHead } from "../ui/Container";
import { MarketingButton } from "../ui/MarketingButton";

type Tier = {
  name: string;
  tagline: string;
  amount: string;
  per: string;
  cta: string;
  ctaVariant: "primary" | "secondary";
  featured?: boolean;
  badge?: string;
  features: { label: string; section?: boolean }[];
};

const TIERS: Tier[] = [
  {
    name: "Free",
    tagline: "Perfect for single-building operators getting started.",
    amount: "0",
    per: "forever",
    cta: "Start free",
    ctaVariant: "secondary",
    features: [
      { label: "1 building, up to 15 units" },
      { label: "1 user account" },
      { label: "All core reservation features" },
      { label: "Invoicing in OMR with VAT" },
      { label: "Email support" },
      { label: "Free forever — no card on file" },
    ],
  },
  {
    name: "Professional",
    tagline: "For growing property businesses across 2 buildings.",
    amount: "25",
    per: "/month",
    cta: "Start 14-day trial",
    ctaVariant: "primary",
    featured: true,
    badge: "Most popular",
    features: [
      { label: "Up to 2 buildings, 30 units" },
      { label: "3 user accounts with roles" },
      { label: "Everything in Free, plus", section: true },
      { label: "Expense approval workflow" },
      { label: "Khareef seasonal pricing" },
      { label: "Advanced reports & CSV export" },
      { label: "Email & WhatsApp support" },
    ],
  },
  {
    name: "Business",
    tagline: "For multi-building operations and growing portfolios.",
    amount: "75",
    per: "/month",
    cta: "Start 14-day trial",
    ctaVariant: "secondary",
    features: [
      { label: "Unlimited buildings & units" },
      { label: "Unlimited user accounts" },
      { label: "Everything in Professional, plus", section: true },
      { label: "Multi-building dashboards" },
      { label: "Custom report builder" },
      { label: "Priority support & dedicated onboarding" },
      { label: "API access & channel manager sync" },
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" data-screen-label="Pricing" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow="Simple, honest pricing"
          title="Free to start. Scale as you grow."
          description="No setup fees. No per-reservation charges. No surprise invoices at the end of the year. Cancel anytime."
        />
        <div className="grid items-stretch gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className={[
                "relative flex flex-col rounded-lg border bg-white p-8",
                t.featured
                  ? "border-brand-500 shadow-[0_0_0_1px_var(--brand-500),0_12px_32px_-12px_oklch(0.46_0.17_258/0.3)] md:-translate-y-2 bg-gradient-to-b from-white to-[oklch(0.99_0.005_258)]"
                  : "border-gray-200",
              ].join(" ")}
            >
              {t.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-white">
                  {t.badge}
                </span>
              )}
              <div className="mb-1.5 text-[15px] font-semibold text-gray-900">{t.name}</div>
              <p className="m-0 mb-6 text-sm text-gray-600">{t.tagline}</p>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {t.amount}
                </span>
                <span className="font-mono text-sm uppercase text-gray-500">OMR</span>
                <span className="text-sm text-gray-500">{t.per}</span>
              </div>
              <div className="mt-5 mb-6">
                <MarketingButton href="#trial" variant={t.ctaVariant} size="lg" fullWidth>
                  {t.cta}
                </MarketingButton>
              </div>
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {t.features.map((f) => (
                  <li
                    key={f.label}
                    className={
                      f.section
                        ? "mt-2 border-t border-gray-200 pt-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-gray-500"
                        : "flex items-start gap-2.5 text-sm text-gray-700"
                    }
                  >
                    {!f.section && (
                      <span className="mt-px grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full bg-success-50 text-[12px] font-bold text-success-700">
                        ✓
                      </span>
                    )}
                    {f.label}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
