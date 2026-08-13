"use client";

import { useState } from "react";
import { Check, Sparkles, Gift, Zap } from "lucide-react";
import Container from "./ui/Container";
import { MarketingButton } from "./ui/MarketingButton";

export default function PricingClientSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const plans = [
    {
      id: "starter",
      name: "الخطة الأولى (المبتدئ)",
      desc: "مثالية للمباني الفردية وإدارة العقارات الصغيرة",
      monthlyPrice: 15,
      yearlyPrice: 10,
      highlightBadge: "تجربة مجانية لمدة شهريْن 🎁",
      highlightBadgeBg: "bg-[#1f9d64] text-white",
      trialNote: "يمكن تجربة هذه الخطة مجانًا لمدة شهريْن كاملين بدون بطاقة ائتمان",
      featured: false,
      ctaText: "تجربة مجانية لمدة شهريْن",
      ctaHref: "/login?mode=signup&plan=starter",
      features: [
        "مبنى واحد (1 Building)",
        "من 1 إلى 20 وحدة (1-20 Units)",
        "مستخدمان اثنان (2 Users)",
        "مستأجرون غير محدودين (Unlimited Tenants)",
        "حجوزات غير محدودة (Unlimited Reservations)",
        "مدفوعات وفواتير غير محدودة",
        "مصروفات وتقارير غير محدودة",
      ],
    },
    {
      id: "growth",
      name: "الخطة الثانية (النمو الاحترافي)",
      desc: "الخطة الأكثر شعبية لمؤسسات إدارة العقارات المتنامية",
      monthlyPrice: 30,
      yearlyPrice: 25,
      highlightBadge: "الأكثر شعبية ⭐",
      highlightBadgeBg: "bg-brand-500 text-white",
      featured: true,
      ctaText: "ابدأ الخطة الاحترافية",
      ctaHref: "/login?mode=signup&plan=pro",
      features: [
        "5 مبانٍ (5 Buildings)",
        "وحدات غير محدودة (Unlimited Units)",
        "5 مستخدمين (5 Users)",
        "مستأجرون غير محدودين",
        "حجوزات ومدفوعات غير محدودة",
        "مصروفات وتقارير غير محدودة",
        "موقع حجز إلكتروني خاص (Booking Website)",
      ],
    },
    {
      id: "ultimate",
      name: "الخطة الثالثة (الشاملة / المؤسسات)",
      desc: "حل متكامل مع الذكاء الاصطناعي وربط الواتساب والدفع الإلكتروني",
      monthlyPrice: 75,
      yearlyPrice: 60,
      highlightBadge: "الذكاء الاصطناعي والواتساب 🤖",
      highlightBadgeBg: "bg-indigo-600 text-white",
      featured: false,
      ctaText: "اشترك في الخطة الشاملة",
      ctaHref: "/login?mode=signup&plan=ultimate",
      features: [
        "مبانٍ غير محدودة (Unlimited Buildings)",
        "مستخدمون غير محدودين (Unlimited Users)",
        "مستأجرون وحجوزات ومدفوعات ومصروفات غير محدودة",
        "موقع حجز إلكتروني مع دفع إلكتروني (Online Payments)",
        "مساعد الذكاء الاصطناعي (AI Assistant)",
        "ربط الواتساب المباشر (WhatsApp Integration)",
        "روبوت محادثة ذكي للموقع والواتساب (AI Chatbot)",
      ],
    },
  ];

  return (
    <section id="pricing" data-screen-label="Pricing" className="border-b border-gray-200 bg-white py-16 md:py-24">
      <Container className="max-w-[1140px]">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            <Zap className="h-3.5 w-3.5" />
            <span>خطط الأسعار والاشتراكات</span>
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            اختر الخطة المناسبة لحجم محفظتك العقارية
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            خطط مرنة مصممة خصيصًا لمديري الأملاك والعقارات في صلالة وعُمان. يمكنك التغيير أو الترقية في أي وقت.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50/80 p-1.5 shadow-sm">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${
                billingCycle === "monthly"
                  ? "bg-white text-gray-900 shadow-md border border-gray-200/60"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              الدفع الشهري
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-brand-500 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <span>الدفع السنوي</span>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-gray-900 uppercase">
                وفر حتى 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid items-stretch gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const price = billingCycle === "yearly" ? p.yearlyPrice : p.monthlyPrice;

            return (
              <article
                key={p.id}
                className={`relative flex flex-col justify-between rounded-[24px] border p-8 transition-all duration-300 ${
                  p.featured
                    ? "border-brand-500 bg-gradient-to-b from-brand-600 via-brand-700 to-brand-800 text-white shadow-[0_25px_60px_-15px_rgba(24,95,165,0.4)] md:-mt-3 md:mb-[-12px] z-10"
                    : "border-gray-200 bg-white shadow-[0_10px_30px_-15px_rgba(15,39,64,0.08)] hover:shadow-xl hover:-translate-y-1"
                }`}
              >
                {/* Top Badge */}
                {p.highlightBadge && (
                  <div className="absolute -top-3.5 start-6">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${p.highlightBadgeBg}`}>
                      {p.highlightBadge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Plan Name & Desc */}
                  <div className="mt-2">
                    <h3 className={`text-xl font-bold ${p.featured ? "text-white" : "text-gray-900"}`}>
                      {p.name}
                    </h3>
                    <p className={`mt-2 text-xs leading-relaxed ${p.featured ? "text-brand-100" : "text-gray-500"}`}>
                      {p.desc}
                    </p>
                  </div>

                  {/* Free Trial Banner for Starter Plan */}
                  {p.id === "starter" && (
                    <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                      <Gift className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>{p.trialNote}</span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="mt-6 flex items-baseline gap-1.5 border-b border-gray-100 pb-6 dark:border-white/10">
                    <span className={`font-mono text-4xl font-extrabold tracking-tight ${p.featured ? "text-white" : "text-gray-900"}`} dir="ltr">
                      {price}
                    </span>
                    <span className={`text-sm font-semibold ${p.featured ? "text-brand-200" : "text-gray-500"}`}>
                      ريال عُماني / شهريًا
                    </span>
                    {billingCycle === "yearly" && (
                      <span className={`ms-auto text-[11px] font-bold rounded-md px-2 py-0.5 ${
                        p.featured ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        فوتِر سنويًا
                      </span>
                    )}
                  </div>

                  {/* Features List */}
                  <ul className="mt-6 space-y-3.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className={`mt-0.5 rounded-full p-0.5 flex-none ${
                          p.featured ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"
                        }`}>
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <span className={`font-medium ${p.featured ? "text-gray-100" : "text-gray-700"}`}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-4">
                  <MarketingButton
                    href={p.ctaHref}
                    variant={p.featured ? "secondary" : "primary"}
                    size="xl"
                    fullWidth
                  >
                    {p.ctaText}
                  </MarketingButton>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
