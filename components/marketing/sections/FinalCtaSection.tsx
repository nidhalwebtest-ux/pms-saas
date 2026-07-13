import { getTranslations } from "next-intl/server";
import Container from "../ui/Container";
import { Reveal } from "../ui/Reveal";
import { MarketingButton } from "../ui/MarketingButton";

export default async function FinalCtaSection() {
  const t = await getTranslations("marketing.finalcta");
  const tHero = await getTranslations("marketing.hero");
  return (
    <section
      data-screen-label="Final CTA"
      className="text-white"
      style={{ background: "linear-gradient(135deg,#124b82,#185FA5 55%,#2a7bc4)" }}
    >
      <Container className="max-w-[820px] py-20 text-center md:py-28">
        <Reveal>
          <h2 className="m-0 text-[30px] font-bold leading-[1.12] tracking-[-0.025em] text-balance md:text-[50px]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-[18px] max-w-[520px] text-[16px] leading-[1.6] text-[#dbe9f7] md:text-[20px]">
            {t("sub")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <MarketingButton href="/login?mode=signup" variant="secondary" size="xl">
              {t("cta1")}
            </MarketingButton>
            <MarketingButton href="/contact" variant="ghost" size="xl">
              {t("cta2")}
            </MarketingButton>
          </div>
          <p className="mt-5 text-[14px] text-[#c4dcf3]">{tHero("note")}</p>
        </Reveal>
      </Container>
    </section>
  );
}
