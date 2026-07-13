import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container, { SectionHead } from "../ui/Container";
import { Reveal } from "../ui/Reveal";

type Item = { q: string; n: string; r: string };

export default async function TestimonialsSection() {
  const t = await getTranslations("marketing.testimonials");
  const items = t.raw("items") as Item[];
  return (
    <section data-screen-label="Testimonials" className="border-b border-gray-200 bg-gray-50 py-16 md:py-24">
      <Container>
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} />
        <div className="grid gap-[18px] md:grid-cols-3">
          {items.map((c, i) => (
            <Reveal key={c.n} delay={i * 100}>
              <article className="flex h-full flex-col gap-[18px] rounded-[18px] border border-gray-200 bg-white p-7">
                <div className="flex gap-[3px]">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-[18px] w-[18px] fill-[#f5a623] text-[#f5a623]" strokeWidth={0} />
                  ))}
                </div>
                <p className="m-0 flex-1 text-[16px] font-medium leading-[1.6] text-gray-900 text-pretty">{c.q}</p>
                <div className="mt-auto flex items-center gap-3">
                  <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-brand-500 text-[16px] font-bold text-white">
                    {c.n.trim().charAt(0)}
                  </span>
                  <div>
                    <div className="text-[14.5px] font-bold text-gray-900">{c.n}</div>
                    <div className="text-[13px] text-gray-400">{c.r}</div>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
