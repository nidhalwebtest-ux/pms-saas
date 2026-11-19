import { getLocale, getTranslations } from "next-intl/server";
import { Zap } from "lucide-react";
import Container from "../../ui/Container";
import PlanCards from "@/components/subscription/PlanCards";
import { getPublicPlans } from "@/lib/subscription";

/* Landing v2 · pricing — the flat-tier plans (Starter / Pro / Ultimate), read from the
 * SubscriptionPlan table (super-admin edits them; cached, see getPublicPlans). Replaces the
 * per-unit PricingStory section, which is kept in the repo but no longer rendered.
 * Same light "sheet" wrapper as PricingStory so it rises over the dark story above. */
export default async function PlansSection() {
  const [{ plans, trialDays, freePlanKey }, t, locale] = await Promise.all([
    getPublicPlans(),
    getTranslations("subscription.plans"),
    getLocale(),
  ]);
  const free = plans.find((p) => p.key === freePlanKey) ?? plans.find((p) => p.free);
  const ar = locale === "ar";

  return (
    <section
      id="pricing"
      data-screen-label="Pricing"
      className="relative z-[1] -mt-12 scroll-mt-16 rounded-t-[32px] bg-white pb-20 pt-16 shadow-[0_-18px_50px_-12px_rgba(11,31,58,.35)] md:-mt-20 md:rounded-t-[56px] md:pb-28 md:pt-24"
    >
      <Container wide>
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-600">
            <Zap className="h-3.5 w-3.5" />
            <span>{t("eyebrow")}</span>
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">{t("title")}</h2>
          <p className="mt-3 text-lg text-gray-600">{t("sub", { days: trialDays })}</p>
        </div>

        <PlanCards plans={plans} cta={{ kind: "signup" }} />

        {free && free.maxBuildings !== null && free.maxUnits !== null && (
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500">
            {t("freeNote", {
              plan: ar ? free.nameAr : free.nameEn,
              limits: t("freeLimits", { buildings: free.maxBuildings, units: free.maxUnits }),
            })}
          </p>
        )}
      </Container>
    </section>
  );
}
