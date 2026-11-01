import { notFound } from "next/navigation";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import Container from "@/components/marketing/ui/Container";
import { landingFontClass } from "@/components/marketing/v2/fonts";
import { StorySection } from "@/components/marketing/v2/StorySection";
import { Laptop, Phone } from "@/components/marketing/v2/Device";
import { FocusTour, type TourStep } from "@/components/marketing/v2/FocusTour";
import { GoldCheck } from "@/components/marketing/v2/GoldCheck";
import { RollingNumber } from "@/components/marketing/v2/RollingNumber";
import { DuoIcon, type IconName } from "@/components/marketing/v2/icons";
import { SCREENS, FOCUS, type Rect } from "@/lib/marketing/screens";
import s from "@/components/marketing/v2/landing.module.css";

/* Landing v2 — phase 1 preview of the building blocks (dev only; 404 in production).
 * Everything shown is a real app capture; overlays are explanatory. */

export const metadata = { robots: { index: false, follow: false } };

const pad = (r: Rect, x = 22, y = 26): Rect => [r[0] - x, r[1] - y, r[2] + 2 * x, r[3] + 2 * y];

const DASH_STEPS: TourStep[] = Object.values(FOCUS.dashboard).map((r) => ({ rect: pad(r as Rect), glow: r as Rect, hold: 0.8 }));
const PRICE_STEPS: TourStep[] = [{ rect: FOCUS.pricing.view as Rect, glow: FOCUS.pricing.key as Rect, hold: 1.2, maxScale: 2.2 }];
const OVERDUE_STEPS: TourStep[] = [{ rect: FOCUS.overdue.view as Rect, glow: FOCUS.overdue.key as Rect, hold: 1.2, maxScale: 2.2 }];

const PAIN_ICONS: IconName[] = ["chatsCircle", "calendarX", "doorOpen", "tag", "handCoins"];

export default function MarketingLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className={`overflow-x-clip ${landingFontClass}`}>
      <MarketingNavbar />
      <main>
        <section className="border-b border-gray-200 bg-white py-14">
          <Container>
            <h1 className="text-[34px] font-bold text-gray-900">Landing v2 · phase 1 building blocks</h1>
            <p className="mt-2 text-[17px] text-gray-600">
              Navbar (4 story anchors, gold WhatsApp CTA, reading-progress bar) · story section with RTL wipe ·
              CSS devices · camera focus tours on real captures · gold ✓ · rolling numbers · duotone icons.
            </p>
          </Container>
        </section>

        <StorySection id="problems" label="Lab · story section" className="py-20 md:py-28">
          <Container>
            <p className="text-[15px] font-semibold text-[#85B7EB]">StorySection + wipe + glass + icons + gold ✓</p>
            <h2 className="mt-3 text-[40px] font-bold leading-[1.2] md:text-[56px]">أكيد تعرف هذه المشاكل…</h2>
            <div className="mt-10 grid gap-4 md:max-w-[760px]">
              {["بيانات مبعثرة بين الواتساب والدفاتر", "حجوزات مزدوجة لنفس الشقة", "لا تعرف الوحدات الشاغرة والمشغولة"].map((t, i) => (
                <div key={t} className={`${s.glass} flex items-center gap-5 px-6 py-5`}>
                  <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[#85B7EB]/15 text-[#85B7EB]">
                    {i === 0 ? <GoldCheck size={34} /> : <DuoIcon name={PAIN_ICONS[i]} size={32} />}
                  </span>
                  <span className="text-[20px] md:text-[24px]">{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-4 text-[#85B7EB]">
              {(["chatsCircle", "calendarX", "doorOpen", "tag", "handCoins", "buildings", "receipt", "wallet", "vault", "globe", "whatsappLogo"] as IconName[]).map((n) => (
                <DuoIcon key={n} name={n} size={40} />
              ))}
            </div>
          </Container>
        </StorySection>

        <StorySection id="solution" label="Lab · devices" className="py-20 md:py-28">
          <Container wide>
            <p className="text-[15px] font-semibold text-[#85B7EB]">Laptop · camera tour over the real dashboard (click to replay)</p>
            <h2 className="mt-3 text-[34px] font-bold md:text-[46px]">كل بياناتك في مكان واحد</h2>
            <div className="mx-auto mt-10 max-w-[820px]">
              <Laptop>
                <FocusTour screen={SCREENS.dashboard} alt="لوحة تحكم بناية: الوصول والمغادرة والتجاوزات والنزلاء" steps={DASH_STEPS} loop sizes="(min-width: 1024px) 820px, 92vw" />
              </Laptop>
            </div>

            <div className="mt-20 grid items-center gap-12 md:grid-cols-2">
              <div className="mx-auto w-[min(78vw,330px)]">
                <Phone aspect={SCREENS.pricing.cssWidth / SCREENS.pricing.cssHeight}>
                  <FocusTour screen={SCREENS.pricing} alt="أسعار الوحدة: السعر الافتراضي وسعر موسم الذروة" steps={PRICE_STEPS} sizes="330px" />
                </Phone>
              </div>
              <div>
                <h3 className="text-[30px] font-bold md:text-[40px]">سعر الموسم يُطبَّق تلقائيًا</h3>
                <div className={`${s.glass} mt-6 inline-flex flex-col items-center px-10 py-4`}>
                  <small className="text-[17px] text-white/75">سعر الليلة · ر.ع</small>
                  <RollingNumber from={20000} to={40000} className={`${s.goldNum} text-[56px] font-bold leading-tight`} />
                </div>
              </div>
            </div>

            <div className="mt-20 grid items-center gap-12 md:grid-cols-2">
              <div className="md:order-2 mx-auto w-[min(78vw,330px)]">
                <Phone>
                  <FocusTour screen={SCREENS.overdue} alt="قائمة الفواتير المتأخرة مع المبلغ المتبقي" steps={OVERDUE_STEPS} sizes="330px" />
                </Phone>
              </div>
              <div>
                <h3 className="text-[30px] font-bold md:text-[40px]">والمتأخرات؟ تعرفها فورًا</h3>
                <div className={`${s.glass} mt-6 inline-flex flex-col items-center px-10 py-4`}>
                  <small className="text-[17px] text-white/75">إجمالي المستحق · ر.ع</small>
                  <RollingNumber to={402000} className={`${s.goldNum} text-[56px] font-bold leading-tight`} />
                </div>
              </div>
            </div>
          </Container>
        </StorySection>

        <section id="pricing" className="bg-white py-24">
          <Container><h2 className="text-[30px] font-bold text-gray-900">#pricing (placeholder for the scroll-spy test)</h2></Container>
        </section>
        <section id="contact" className="bg-gray-50 py-24">
          <Container><h2 className="text-[30px] font-bold text-gray-900">#contact (placeholder for the scroll-spy test)</h2></Container>
        </section>
      </main>
    </div>
  );
}
