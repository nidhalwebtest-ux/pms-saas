import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { CardIcon, type CardIconKey } from "../ui/CardIcon";

type Card = { t: string; d: string; ic: CardIconKey };

export default async function BuiltForOmanSection() {
  const t = await getTranslations("marketing.oman");
  const cards = t.raw("cards") as Card[];
  return (
    <section
      id="oman"
      data-screen-label="Built for Oman"
      className="border-b border-gray-200 py-16 md:py-24"
      style={{ background: "linear-gradient(180deg,#eaf3fc,#f6f9fd)" }}
    >
      <Container>
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid gap-[18px] md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 100}>
              <article className="h-full rounded-[18px] border border-gray-200 bg-white p-7 shadow-[0_12px_30px_-20px_rgba(24,95,165,.25)]">
                <span className="mb-[18px] grid h-12 w-12 place-items-center rounded-[13px] bg-brand-50 text-brand-500">
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
