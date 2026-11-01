import { getTranslations } from "next-intl/server";
import Container from "../../ui/Container";
import { Reveal } from "../../ui/Reveal";
import { DuoIcon, type IconName } from "../icons";
import s from "../landing.module.css";

/* Landing v2 · section 5 — «بالعربي، ومن جوالك»: four true facts that close the dark story
 * (replaces the old RTL preview with its hand-drawn cards). Copy: messages marketing.strip. */

type Item = { icon: IconName; t: string; d: string };

export default async function StripSection() {
  const t = await getTranslations("marketing.strip");
  const items = t.raw("items") as Item[];
  return (
    <section data-screen-label="Arabic & mobile" className={`${s.root} ${s.story} pb-28 pt-10 md:pb-40 md:pt-16`}>
      <div className={s.hex} aria-hidden="true" />
      <Container wide className="relative">
        <h2 className="text-center text-[30px] font-bold leading-[1.3] md:text-[44px]">{t("title")}</h2>
        <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {items.map((it, i) => (
            <Reveal key={it.t} as="li" delay={i * 90}>
              <div className={`${s.glass} h-full p-6`}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#85B7EB]/15 text-[#85B7EB]">
                  <DuoIcon name={it.icon} size={28} />
                </span>
                <h3 className="mt-5 text-[20px] font-bold">{it.t}</h3>
                <p className="mt-2 text-[16px] leading-[1.65] text-white/75">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
