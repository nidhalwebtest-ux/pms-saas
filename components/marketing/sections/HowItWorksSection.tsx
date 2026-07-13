import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

type Step = { n: string; t: string; d: string };

export default async function HowItWorksSection() {
  const t = await getTranslations("marketing.steps");
  const items = t.raw("items") as Step[];
  return (
    <section id="how" data-screen-label="How it works" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container className="max-w-[1080px]">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="h-full rounded-[18px] border border-gray-200 bg-gray-50 p-7">
                <div className="font-mono text-[34px] font-semibold leading-none text-brand-300" dir="ltr">{s.n}</div>
                <h3 className="mb-2 mt-3.5 text-[19px] font-bold text-gray-900">{s.t}</h3>
                <p className="m-0 text-[15px] leading-[1.6] text-gray-600">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-9 text-center">
          <MarketingButton href="/login?mode=signup" variant="primary" size="lg">
            {t("cta")}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.75} />
          </MarketingButton>
        </div>
      </Container>
    </section>
  );
}
