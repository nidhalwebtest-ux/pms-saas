import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { parseLongStayTiers } from "@/lib/stay-rules";
import WeekendRuleForm from "./WeekendRuleForm";
import { MinNightsCard, LongStayCard } from "./StayRuleCards";

/** Pricing → Stay rules: organization-wide weekend pricing, minimum stay and long-stay discounts. */
export default async function StayRulesPage() {
  const { organizationId } = await requireOrgUser();
  const [access, org] = await Promise.all([
    getSessionAccess(),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { weekendDays: true, weekendAdjustPct: true, defaultMinNights: true, longStayDiscounts: true },
    }),
  ]);
  const canEdit = !!access?.can("units", "EDIT");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <WeekendRuleForm canEdit={canEdit} initialDays={org?.weekendDays ?? []} initialPct={org?.weekendAdjustPct ?? 0} />
      <MinNightsCard canEdit={canEdit} initial={Math.max(1, org?.defaultMinNights ?? 1)} />
      <LongStayCard canEdit={canEdit} initial={parseLongStayTiers(org?.longStayDiscounts)} />
    </div>
  );
}
