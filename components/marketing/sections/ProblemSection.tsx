import { ListChecks, Table, Car, ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";

export default async function ProblemSection() {
  const t = await getTranslations("marketing.problem");
  const PROBLEMS = [
    { Icon: ListChecks, title: t("lostTitle"),  body: t("lostBody") },
    { Icon: Table,      title: t("sheetTitle"), body: t("sheetBody") },
    { Icon: Car,        title: t("carTitle"),   body: t("carBody") },
    { Icon: ScrollText, title: t("reconTitle"), body: t("reconBody") },
  ];
  return (
    <section data-screen-label="Problem" className="py-16 md:py-24">
      <Container>
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 80}>
              <article className="group relative h-full rounded-lg border border-gray-200 bg-white p-7 transition-all duration-200 hover:-translate-y-1 hover:border-error-200 hover:shadow-lg">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] bg-error-50 text-error-500 transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="mb-1.5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="m-0 text-sm leading-[1.55] text-gray-600">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
