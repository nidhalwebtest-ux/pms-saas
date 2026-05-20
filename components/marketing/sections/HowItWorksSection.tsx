import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

export default async function HowItWorksSection() {
  const t = await getTranslations("marketing.how");
  const STEPS = [
    { n: "01", title: t("step1Title"), body: t("step1Body") },
    { n: "02", title: t("step2Title"), body: t("step2Body") },
    { n: "03", title: t("step3Title"), body: t("step3Body") },
  ];
  return (
    <section id="how" data-screen-label="How it works" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="steps-dotline relative grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 150}>
              <div className="relative z-10 text-center">
                <div className="group relative mx-auto mb-6 grid h-[76px] w-[76px] place-items-center rounded-full border border-gray-200 bg-white font-mono text-[22px] font-semibold text-brand-600 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
                  <span className="absolute -inset-1.5 rounded-full border border-brand-100 transition-transform group-hover:scale-105" />
                  {s.n}
                </div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="m-0 mx-auto max-w-[280px] text-[14.5px] text-gray-600">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center">
          <MarketingButton href="#trial" variant="primary" size="lg">
            {t("cta")}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.75} />
          </MarketingButton>
        </div>
      </Container>
    </section>
  );
}
