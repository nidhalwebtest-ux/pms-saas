import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon, StarIcon } from "@heroicons/react/24/outline";
import { getSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/subscription";
import { formatOmr, isFreePlan } from "@/lib/subscription-core";
import { Badge } from "@/components/ui/Badge";
import TrialSettingsForm from "./TrialSettingsForm";

/** Super-admin → Subscriptions: trial settings + the plan catalogue. */
export default async function AdminSubscriptionsPage() {
  if (!(await getSuperAdmin())) redirect("/dashboard");

  const [settings, plans] = await Promise.all([
    getPlatformSettings(),
    prisma.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { organizations: true } } },
    }),
  ]);
  const limit = (n: number | null) => (n === null ? "∞" : String(n));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-fg">Subscriptions</h2>
        <p className="text-sm text-fg-tertiary">
          Plans, prices and limits. Each organization&apos;s subscription is managed from its page under Organizations.
        </p>
      </div>

      <TrialSettingsForm
        settings={{ trialDays: settings.trialDays, trialPlanKey: settings.trialPlanKey, freePlanKey: settings.freePlanKey }}
        plans={plans.map((p) => ({ key: p.key, name: p.nameEn, free: isFreePlan(p) }))}
      />

      <section className="rounded-2xl border border-border-default bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border-default p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-semibold text-fg">Plans</h3>
            <p className="mt-0.5 text-xs text-fg-tertiary">Prices are per month for each billing cycle (OMR). ∞ = unlimited.</p>
          </div>
          <Link
            href="/admin/subscriptions/plans/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4" /> New plan
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-start text-xs text-fg-tertiary">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">Plan</th>
                <th className="px-4 py-2.5 text-end font-medium">Monthly</th>
                <th className="px-4 py-2.5 text-end font-medium">6-month</th>
                <th className="px-4 py-2.5 text-end font-medium">Yearly</th>
                <th className="px-4 py-2.5 text-center font-medium">Buildings · Units · Users</th>
                <th className="px-4 py-2.5 text-start font-medium">Features</th>
                <th className="px-4 py-2.5 text-end font-medium">Orgs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {plans.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/subscriptions/plans/${p.id}`} className="font-semibold text-fg hover:text-brand-600">
                      {p.nameEn}
                    </Link>
                    <span className="ms-1.5 text-xs text-fg-tertiary" dir="rtl">{p.nameAr}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="font-mono text-[11px] text-fg-tertiary">{p.key}</span>
                      {p.key === settings.trialPlanKey && <Badge tone="info" appearance="subtle" size="sm">Trial</Badge>}
                      {p.key === settings.freePlanKey && <Badge tone="neutral" appearance="subtle" size="sm">Fallback</Badge>}
                      {p.isFeatured && <Badge tone="brand" appearance="subtle" size="sm"><StarIcon className="h-3 w-3" /> Featured</Badge>}
                      {!p.isPublic && <Badge tone="warning" appearance="subtle" size="sm">Private</Badge>}
                      {!p.isActive && <Badge tone="neutral" appearance="subtle" size="sm">Inactive</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{formatOmr(p.priceMonthlyBaisa)}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{formatOmr(p.priceSemiannualBaisa)}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{formatOmr(p.priceYearlyBaisa)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {limit(p.maxBuildings)} · {limit(p.maxUnits)} · {limit(p.maxUsers)}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-secondary">
                    {[p.featureWebsite && "Website", p.featureWhatsapp && "WhatsApp", p.featureOnlinePayments && "Online pay", p.featureAiAssistant && "AI"]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{p._count.organizations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
