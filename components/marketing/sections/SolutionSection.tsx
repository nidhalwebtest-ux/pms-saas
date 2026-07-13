import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { CardIcon, type CardIconKey } from "../ui/CardIcon";

type Card = { t: string; d: string; ic: CardIconKey };

export default async function SolutionSection() {
  const t = await getTranslations("marketing.solution");
  const cards = t.raw("cards") as Card[];
  return (
    <section data-screen-label="Solution" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container>
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid gap-[18px] md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 100}>
              <article className="group h-full rounded-[18px] border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_16px_34px_-18px_rgba(24,95,165,.28)]">
                <span className="mb-[18px] grid h-12 w-12 place-items-center rounded-[13px] bg-brand-500 text-white">
                  <CardIcon name={c.ic} className="h-6 w-6" />
                </span>
                <h3 className="mb-2 text-[19px] font-bold text-gray-900">{c.t}</h3>
                <p className="m-0 text-[15px] leading-[1.6] text-gray-600">{c.d}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
