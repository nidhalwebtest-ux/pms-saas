import { ArrowRight, Check, PlayCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Container from "../ui/Container";
import { MarketingButton } from "../ui/MarketingButton";
import HeroVideoPlayer from "../HeroVideoPlayer";

/* Hero — headline + creative software video player container for Binaya_Demo.mp4 */
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
            <MarketingButton href="#pricing" variant="secondary" size="xl">
              {t("cta2")}
            </MarketingButton>
          </div>
          <p className="mt-[18px] flex items-center gap-2 text-[14px] text-gray-500">
            <Check className="h-4 w-4 text-[#1f9d64]" strokeWidth={2.4} />
            {t("note")}
          </p>
        </div>

        {/* Video Player Container */}
        <div className="relative">
          <HeroVideoPlayer
            videoTitle={t("videoTitle", { defaultValue: "شاهد كيف يعمل نظام بناية في دقيقة واحدة" })}
            videoSub={t("videoSub", { defaultValue: "انقر لتشغيل فيديو العرض التوضيحي للنظام" })}
          />
        </div>
      </Container>
    </section>
  );
}

