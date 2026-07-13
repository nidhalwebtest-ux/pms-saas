import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

type Tier = {
  name: string; desc: string; price: string; per: string; cta: string;
  features: string[]; featured: boolean; badge: string;
};

export default async function PricingSection() {
  const t = await getTranslations("marketing.pricing");
  const tiers = t.raw("tiers") as Tier[];
  const unit = t("unit");
  const noUnit = new Set(["Custom", "حسب الطلب"]);

  return (
    <section id="pricing" data-screen-label="Pricing" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container className="max-w-[1120px]">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid items-start gap-5 md:grid-cols-3">
          {tiers.map((p, i) => (
            <Reveal key={p.name} delay={i * 100}>
              <article
                className={[
                  "relative flex h-full flex-col rounded-[20px] border p-7 transition-transform duration-300",
                  p.featured
                    ? "border-brand-700 bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[0_26px_54px_-22px_rgba(24,95,165,.5)] md:-mt-2"
                    : "border-gray-200 bg-white shadow-[0_14px_32px_-22px_rgba(15,39,64,.2)] hover:-translate-y-1",
                ].join(" ")}
              >
                {p.badge && (
                  <span className="absolute -top-3 start-6 rounded-full bg-brand-500 px-3 py-[5px] text-[12px] font-bold text-white shadow-sm">
                    {p.badge}
                  </span>
                )}
                <div className={["text-[16px] font-bold", p.featured ? "text-white" : "text-gray-900"].join(" ")}>
                  {p.name}
                </div>
                <p className={["mb-[18px] mt-1.5 min-h-[20px] text-[13.5px]", p.featured ? "text-[#c4dcf3]" : "text-gray-400"].join(" ")}>
                  {p.desc}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className={["font-mono text-[38px] font-semibold", p.featured ? "text-white" : "text-gray-900"].join(" ")} dir="ltr">
                    {p.price}
                  </span>
                  <span className={["text-[13px]", p.featured ? "text-[#c4dcf3]" : "text-gray-400"].join(" ")}>
                    {noUnit.has(p.price) ? "" : unit}{p.per}
                  </span>
                </div>
                <div className="mt-[22px]">
                  <MarketingButton
                    href="/login?mode=signup"
                    variant={p.featured ? "secondary" : "primary"}
                    size="lg"
                    fullWidth
                  >
                    {p.cta}
                  </MarketingButton>
                </div>
                <div className={["my-[22px] h-px", p.featured ? "bg-white/20" : "bg-gray-200"].join(" ")} />
                <ul className="m-0 grid list-none gap-3 p-0">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={["mt-px h-[18px] w-[18px] flex-none", p.featured ? "text-brand-300" : "text-brand-500"].join(" ")}
                        strokeWidth={2.4}
                      />
                      <span className={["text-[14.5px]", p.featured ? "text-[#eaf3fc]" : "text-gray-600"].join(" ")}>{f}</span>
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
