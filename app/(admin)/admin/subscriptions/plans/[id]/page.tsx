import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { getSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";
import { formatOmr } from "@/lib/subscription-core";
import PlanForm, { type PlanFormValues } from "./PlanForm";

/** Create (/plans/new) or edit (/plans/{id}) a subscription plan. */
export default async function PlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  const { id } = await params;

  let initial: PlanFormValues;
  let orgCount = 0;
  if (id === "new") {
    initial = {
      key: "", nameEn: "", nameAr: "", descriptionEn: "", descriptionAr: "",
      priceMonthly: "0", priceSemiannual: "0", priceYearly: "0",
      maxBuildings: null, maxUnits: null, maxUsers: null,
      featureWebsite: false, featureWhatsapp: false, featureOnlinePayments: false, featureAiAssistant: false,
      bulletsEn: "", bulletsAr: "", isPublic: false, isFeatured: false, isActive: true, sortOrder: 100,
    };
  } else {
    const p = await prisma.subscriptionPlan.findUnique({ where: { id }, include: { _count: { select: { organizations: true } } } });
    if (!p) notFound();
    orgCount = p._count.organizations;
    initial = {
      id: p.id, key: p.key, nameEn: p.nameEn, nameAr: p.nameAr,
      descriptionEn: p.descriptionEn ?? "", descriptionAr: p.descriptionAr ?? "",
      priceMonthly: formatOmr(p.priceMonthlyBaisa), priceSemiannual: formatOmr(p.priceSemiannualBaisa), priceYearly: formatOmr(p.priceYearlyBaisa),
      maxBuildings: p.maxBuildings, maxUnits: p.maxUnits, maxUsers: p.maxUsers,
      featureWebsite: p.featureWebsite, featureWhatsapp: p.featureWhatsapp,
      featureOnlinePayments: p.featureOnlinePayments, featureAiAssistant: p.featureAiAssistant,
      bulletsEn: p.bulletsEn.join("\n"), bulletsAr: p.bulletsAr.join("\n"),
      isPublic: p.isPublic, isFeatured: p.isFeatured, isActive: p.isActive, sortOrder: p.sortOrder,
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/subscriptions" className="inline-flex items-center gap-1 text-xs text-fg-tertiary hover:text-brand-600">
          <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" /> Subscriptions
        </Link>
        <h2 className="mt-2 text-xl font-bold text-fg">{id === "new" ? "New plan" : `Edit plan — ${initial.nameEn}`}</h2>
        {orgCount > 0 && (
          <p className="text-sm text-fg-tertiary">
            {orgCount} organization{orgCount === 1 ? " is" : "s are"} on this plan — limit and feature changes apply to them immediately.
          </p>
        )}
      </div>
      <PlanForm initial={initial} />
    </div>
  );
}
