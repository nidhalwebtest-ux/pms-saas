import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { CalendarMini, KhareefPricingMini, MultiDeviceMini } from "../mocks";

export default async function SolutionSection() {
  const t = await getTranslations("marketing.solution");
  const SOLUTIONS = [
    { visual: <CalendarMini />,       title: t("calendarTitle"), body: t("calendarBody") },
    { visual: <KhareefPricingMini />, title: t("pricingTitle"),  body: t("pricingBody") },
    { visual: <MultiDeviceMini />,    title: t("deviceTitle"),   body: t("deviceBody") },
  ];
  return (
    <section id="features" data-screen-label="Solution" className="bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {SOLUTIONS.map(({ visual, title, body }, i) => (
            <Reveal key={title} delay={i * 120}>
              <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl">
                <div className="relative h-[180px] overflow-hidden rounded-md border border-gray-200 bg-gray-50 transition-transform duration-300 group-hover:scale-[1.02]">
                  {visual}
                </div>
                <h3 className="mt-5 mb-2 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="m-0 text-[14.5px] text-gray-600">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
