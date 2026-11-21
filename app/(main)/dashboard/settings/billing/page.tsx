import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CreditCardIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { getSessionUser } from "@/lib/current-user";
import { getPublicPlans, getSubscription, getUsage } from "@/lib/subscription";
import { hasFeature, limitFor, type Feature, type LimitKind } from "@/lib/subscription-core";
import { WHATSAPP_NUMBER } from "@/lib/marketing/whatsapp";
import PlanCards from "@/components/subscription/PlanCards";

/** Settings → Plan & billing: current subscription, usage vs limits, plans (Roadmap item 4). */
export default async function BillingPage() {
  const dbUser = await getSessionUser();
  if (!dbUser) redirect("/login");
  const orgId = dbUser.organizationId;
  if (!orgId) redirect("/onboarding");

  const [sub, usage, { plans }, t, locale] = await Promise.all([
    getSubscription(orgId),
    getUsage(orgId),
    getPublicPlans(),
    getTranslations("subscription.billing"),
    getLocale(),
  ]);
  const ar = locale === "ar";
  const nameOf = (p: { nameEn: string; nameAr: string } | null) => (p ? (ar ? p.nameAr : p.nameEn) : "");
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(ar ? "ar-OM" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Muscat" });

  const statusTone = { TRIALING: "bg-info-50 text-info-700", ACTIVE: "bg-success-50 text-success-700", EXPIRED: "bg-error-50 text-error-700", DEMO: "bg-gray-100 text-gray-700" }[sub.status];
  const detail =
    sub.status === "DEMO" ? t("demo")
    : sub.status === "TRIALING" && sub.trialEndsAt ? t("trialLeft", { days: sub.daysLeft ?? 0, date: fmtDate(sub.trialEndsAt) })
    : sub.status === "ACTIVE" && sub.paidUntil && sub.daysLeft !== null ? t("paidUntil", { date: fmtDate(sub.paidUntil) })
    : sub.status === "ACTIVE" ? t("freeActive")
    : t("expired", { plan: nameOf(sub.effectivePlan) });

  const kinds: { kind: LimitKind; label: string }[] = [
    { kind: "buildings", label: t("buildings") },
    { kind: "units", label: t("units") },
    { kind: "users", label: t("users") },
  ];
  const features: { f: Feature; label: string }[] = [
    { f: "website", label: t("fWebsite") },
    { f: "whatsapp", label: t("fWhatsapp") },
    { f: "onlinePayments", label: t("fOnlinePayments") },
    { f: "aiAssistant", label: t("fAiAssistant") },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2">
          <CreditCardIcon className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      {/* current plan */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500">{t("currentPlan")}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{sub.status === "DEMO" ? "—" : nameOf(sub.plan)}</p>
            <p className="mt-1 text-sm text-gray-600">{detail}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone}`}>{t(`status.${sub.status}`)}</span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t("usage")}</h2>
            <ul className="mt-3 space-y-3">
              {kinds.map(({ kind, label }) => {
                const limit = limitFor(sub, kind);
                const used = usage[kind];
                const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                const full = limit !== null && used >= limit;
                return (
                  <li key={kind}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-gray-700">{label}</span>
                      <span className={`font-semibold tabular-nums ${full ? "text-warning-700" : "text-gray-900"}`} dir="ltr">
                        {used} / {limit === null ? "∞" : limit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${limit === null ? "bg-success-500/40" : full ? "bg-warning-500" : "bg-brand-500"}`}
                        style={{ width: limit === null ? "100%" : `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t("includes")}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {features.map(({ f, label }) => {
                const on = hasFeature(sub, f);
                return (
                  <li key={f} className={`flex items-center gap-2 text-sm ${on ? "text-gray-800" : "text-gray-400"}`}>
                    {on ? <CheckCircleIcon className="h-5 w-5 text-success-600" /> : <XCircleIcon className="h-5 w-5" />}
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* plans */}
      {sub.status !== "DEMO" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">{t("choose")}</h2>
          <p className="mb-6 mt-1 text-sm text-gray-600">{t("howToPay")}</p>
          <PlanCards
            plans={plans}
            cta={{ kind: "whatsapp", phone: WHATSAPP_NUMBER, orgName: dbUser.organization?.name ?? "", currentPlanKey: sub.status === "EXPIRED" ? null : sub.plan?.key ?? null }}
          />
        </section>
      )}
    </div>
  );
}
