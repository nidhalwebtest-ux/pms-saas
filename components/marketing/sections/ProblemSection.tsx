import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";

type Card = { t: string; d: string };

export default async function ProblemSection() {
  const t = await getTranslations("marketing.problem");
  const cards = t.raw("cards") as Card[];
  return (
    <section data-screen-label="Problem" className="border-b border-gray-200 bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} description={t("sub")} />
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 80}>
              <article className="group h-full rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-[#f0c9c2] hover:shadow-[0_12px_28px_-16px_rgba(200,60,40,.3)]">
                <span className="mb-4 grid h-[42px] w-[42px] place-items-center rounded-[11px] bg-[#fdeeeb] text-[#d9542b]">
                  <AlertTriangle className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </span>
                <h3 className="mb-[7px] text-[17px] font-bold text-gray-900">{c.t}</h3>
                <p className="m-0 text-[14.5px] leading-[1.55] text-gray-600">{c.d}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
