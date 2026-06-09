import { Languages, CircleDollarSign, Waves } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { ArabicUIMini, OMRInvoiceMini, KhareefCalendarMini } from "../mocks";

export default async function BuiltForOmanSection() {
  const t = await getTranslations("marketing.oman");
  const CARDS = [
    { Icon: Languages,        title: t("arabicTitle"),  body: t("arabicBody"),  visual: <ArabicUIMini /> },
    { Icon: CircleDollarSign, title: t("omrTitle"),     body: t("omrBody"),     visual: <OMRInvoiceMini /> },
    { Icon: Waves,            title: t("khareefTitle"), body: t("khareefBody"), visual: <KhareefCalendarMini /> },
  ];
  return (
    <section
      id="oman"
      data-screen-label="Built for Oman"
      className="oman-bg relative overflow-hidden py-16 md:py-24"
    >
      <Container className="relative">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map(({ Icon, title, body, visual }, i) => (
            <Reveal key={title} delay={i * 100}>
              <article className="group h-full rounded-lg border border-khareef-200/60 bg-white p-7 shadow-[0_1px_2px_oklch(0.4_0.1_175/0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-khareef-500/40 hover:shadow-xl">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-[10px] bg-khareef-50 text-khareef-700 transition-transform group-hover:scale-110">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </div>
                <h3 className="mb-2 text-[19px] font-semibold tracking-tight">{title}</h3>
                <p className="mb-4 text-[14.5px] text-gray-600">{body}</p>
                <div className="relative h-[120px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {visual}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
