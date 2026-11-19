"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { formatOmr, formatOmrShort } from "@/lib/subscription-core";
import type { PlanCardDTO } from "@/lib/subscription";

/**
 * Pricing cards with a Monthly / 6-month / Yearly toggle — shared by the
 * landing page (CTA → sign up with ?plan=) and Settings → Plan & billing
 * (CTA → WhatsApp us to subscribe; current plan marked). Free plans aren't
 * shown as a card; the caller renders a one-line note for them.
 * Visual design restored from the legacy flat-tier pricing section (751cf11^).
 */

type Cycle = "MONTHLY" | "SEMIANNUAL" | "YEARLY";

export type PlanCardsCta =
  | { kind: "signup" }
  | { kind: "whatsapp"; phone: string; orgName: string; currentPlanKey: string | null };

export default function PlanCards({ plans, cta }: { plans: PlanCardDTO[]; cta: PlanCardsCta }) {
  const t = useTranslations("subscription.plans");
  const tBilling = useTranslations("subscription.billing");
  const ar = useLocale() === "ar";
  const [cycle, setCycle] = useState<Cycle>("YEARLY");
  const paid = plans.filter((p) => !p.free);

  // best yearly saving across plans, for the toggle badge ("Save up to 33%")
  const yearlySave = Math.max(0, ...paid.map((p) => (p.monthly ? Math.floor(((p.monthly - p.yearly) * 100) / p.monthly) : 0)));
  const price = (p: PlanCardDTO) => (cycle === "YEARLY" ? p.yearly : cycle === "SEMIANNUAL" ? p.semiannual : p.monthly);
  const cycleLabel = { MONTHLY: t("monthly"), SEMIANNUAL: t("semiannual"), YEARLY: t("yearly") }[cycle];

  const ctaFor = (p: PlanCardDTO) => {
    if (cta.kind === "signup") return { href: `/login?mode=signup&plan=${encodeURIComponent(p.key)}`, label: t("ctaStart"), external: false, current: false };
    const msg = tBilling("whatsappMessage", { plan: ar ? p.nameAr : p.nameEn, cycle: cycleLabel, org: cta.orgName });
    return {
      href: `https://wa.me/${cta.phone}?text=${encodeURIComponent(msg)}`,
      label: cta.currentPlanKey === p.key ? t("ctaCurrent") : t("ctaChoose"),
      external: true,
      current: cta.currentPlanKey === p.key,
    };
  };

  const toggle = (c: Cycle, label: string, badge?: string) => (
    <button
      type="button"
      onClick={() => setCycle(c)}
      aria-pressed={cycle === c}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 sm:px-5 ${
        cycle === c ? "bg-brand-500 text-white shadow-md" : "text-gray-500 hover:text-gray-900"
      }`}
    >
      <span>{label}</span>
      {badge && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-gray-900">{badge}</span>}
    </button>
  );

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-3xl border border-gray-200 bg-gray-50/80 p-1.5 shadow-sm sm:rounded-full">
          {toggle("MONTHLY", t("monthly"))}
          {toggle("SEMIANNUAL", t("semiannual"), t("semiannualBadge"))}
          {toggle("YEARLY", t("yearly"), yearlySave > 0 ? t("yearlyBadge", { percent: yearlySave }) : undefined)}
        </div>
      </div>

      <div className={`mt-10 grid items-stretch gap-6 ${paid.length >= 3 ? "md:grid-cols-3" : paid.length === 2 ? "md:grid-cols-2" : ""}`}>
        {paid.map((p) => {
          const c = ctaFor(p);
          const perMonth = price(p);
          const featured = p.featured;
          return (
            <article
              key={p.key}
              className={`relative flex flex-col justify-between rounded-[24px] border p-7 transition-all duration-300 sm:p-8 ${
                featured
                  ? "z-10 border-brand-500 bg-gradient-to-b from-brand-600 via-brand-700 to-brand-800 text-white shadow-[0_25px_60px_-15px_rgba(24,95,165,0.4)] md:-mt-3 md:mb-[-12px]"
                  : "border-gray-200 bg-white shadow-[0_10px_30px_-15px_rgba(15,39,64,0.08)] hover:-translate-y-1 hover:shadow-xl"
              } ${c.current ? "ring-2 ring-amber-400" : ""}`}
            >
              {featured && (
                <div className="absolute -top-3.5 start-6">
                  <span className="inline-flex items-center rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-gray-900 shadow-sm">{t("mostPopular")}</span>
                </div>
              )}
              <div>
                <h3 className={`mt-2 text-xl font-bold ${featured ? "text-white" : "text-gray-900"}`}>{ar ? p.nameAr : p.nameEn}</h3>
                {(ar ? p.descriptionAr : p.descriptionEn) && (
                  <p className={`mt-2 text-xs leading-relaxed ${featured ? "text-brand-100" : "text-gray-500"}`}>{ar ? p.descriptionAr : p.descriptionEn}</p>
                )}

                <div className={`mt-6 border-b pb-6 ${featured ? "border-white/15" : "border-gray-100"}`}>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-4xl font-extrabold tracking-tight ${featured ? "text-white" : "text-gray-900"}`} dir="ltr">
                      {formatOmrShort(perMonth)}
                    </span>
                    <span className={`text-sm font-semibold ${featured ? "text-brand-200" : "text-gray-500"}`}>{t("perMonth")}</span>
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${featured ? "text-brand-100" : "text-gray-500"}`}>
                    {cycle === "MONTHLY" && t("billedMonthly")}
                    {cycle === "SEMIANNUAL" && t("totalSemiannual", { amount: formatOmr(perMonth * 6) })}
                    {cycle === "YEARLY" && t("totalYearly", { amount: formatOmr(perMonth * 12) })}
                  </p>
                </div>

                <ul className="mt-6 space-y-3.5">
                  {(ar ? p.bulletsAr : p.bulletsEn).map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className={`mt-0.5 flex-none rounded-full p-0.5 ${featured ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"}`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span className={`font-medium ${featured ? "text-gray-100" : "text-gray-700"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                {c.current ? (
                  <span className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold ${featured ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700"}`}>
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    data-cta={`plan-${p.key}`}
                    className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold transition-[filter,transform] hover:brightness-105 active:scale-[.99] ${
                      featured ? "bg-white text-brand-700" : "bg-brand-500 text-white"
                    }`}
                  >
                    {c.label}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
