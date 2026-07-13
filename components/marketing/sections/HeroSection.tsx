import { ArrowRight, Check, PlayCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container from "../ui/Container";
import { MarketingButton } from "../ui/MarketingButton";
import { HeroDashboardMock } from "../mocks";

/* Hero — headline + product dashboard mock with a floating "payment received"
   card. Background matches the redesign's soft radial wash. */
export default async function HeroSection() {
  const t = await getTranslations("marketing.hero");
  return (
    <section
      data-screen-label="Hero"
      className="relative overflow-hidden border-b border-gray-200"
      style={{
        background:
          "radial-gradient(120% 90% at 78% -10%, #eaf3fc 0%, #f6f9fd 42%, #ffffff 78%)",
      }}
    >
      <Container className="grid items-center gap-10 py-14 md:gap-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Copy */}
        <div>
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-[13.5px] font-semibold text-brand-500 shadow-sm">
            {t("badge")}
          </span>
          <h1 className="mt-5 text-[38px] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-gray-900 md:text-[60px]">
            {t("t1")} <span className="text-brand-500">{t("t2")}</span> {t("t3")}
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-[1.6] text-gray-600 md:text-[20px]">
            {t("sub")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <MarketingButton href="/login?mode=signup" variant="primary" size="xl">
              {t("cta1")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.75} />
            </MarketingButton>
            <MarketingButton href="#how" variant="secondary" size="xl">
              <PlayCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {t("cta2")}
            </MarketingButton>
          </div>
          <p className="mt-[18px] flex items-center gap-2 text-[14px] text-gray-500">
            <Check className="h-4 w-4 text-[#1f9d64]" strokeWidth={2.4} />
            {t("note")}
          </p>
        </div>

        {/* Product mock + floating card */}
        <div className="relative">
          <div className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-[0_30px_60px_-24px_rgba(15,39,64,.28)]">
            <HeroDashboardMock />
          </div>
          <div className="absolute -bottom-4 -end-3.5 hidden items-center gap-[11px] rounded-[14px] border border-gray-200 bg-white px-[15px] py-3 shadow-[0_16px_34px_-14px_rgba(15,39,64,.3)] sm:flex">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-[#eafaf1]">
              <Check className="h-5 w-5 text-[#1f9d64]" strokeWidth={2.6} />
            </span>
            <div>
              <div className="text-[13px] font-bold text-gray-900">{t("floatTitle")}</div>
              <div className="text-[11.5px] text-gray-400" dir="ltr">{t("floatSub")}</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
