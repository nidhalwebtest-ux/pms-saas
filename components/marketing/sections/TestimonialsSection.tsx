import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { ButtonLink } from "../ui/MarketingButton";

export default async function TestimonialsSection() {
  const t = await getTranslations("marketing.testimonials");
  const TESTIMONIALS = [
    { quote: t("t1Quote"), initials: "AB", name: t("t1Name"), meta: t("t1Meta"), avatarCls: "bg-brand-100 text-brand-700" },
    { quote: t("t2Quote"), initials: "RA", name: t("t2Name"), meta: t("t2Meta"), avatarCls: "bg-[oklch(0.92_0.05_175)] text-khareef-700" },
    { quote: t("t3Quote"), initials: "SK", name: t("t3Name"), meta: t("t3Meta"), avatarCls: "bg-[oklch(0.95_0.04_80)] text-warning-700" },
  ];
  return (
    <section data-screen-label="Testimonials" className="bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((tq, i) => (
            <Reveal key={tq.name} delay={i * 100}>
              <article className="flex h-full flex-col gap-5 rounded-lg border border-gray-200 bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
                <p className="m-0 flex-1 text-base leading-[1.55] text-gray-800 text-pretty">
                  <span className="mb-1 block font-serif text-[40px] leading-none text-brand-300 rtl:rtl-mirror">
                    &ldquo;
                  </span>
                  {tq.quote}
                </p>
                <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
                  <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-sm font-semibold ${tq.avatarCls}`}>
                    {tq.initials}
                  </div>
                  <div>
                    <strong className="block text-sm font-semibold text-gray-900">{tq.name}</strong>
                    <span className="font-mono text-[12.5px] text-gray-500">{tq.meta}</span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="#pricing">
            {t("readMore")}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" strokeWidth={2} />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
