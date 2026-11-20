import { prisma } from "@/lib/prisma";
import { parseLongStayTiers, type LongStayTier } from "@/lib/stay-rules";

export type OrgStayRules = { defaultMinNights: number; longStayTiers: LongStayTier[] };

/** The organization's stay rules (Pricing → Stay rules). */
export async function getOrgStayRules(organizationId: string): Promise<OrgStayRules> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { defaultMinNights: true, longStayDiscounts: true },
  });
  return {
    defaultMinNights: Math.max(1, org?.defaultMinNights ?? 1),
    longStayTiers: parseLongStayTiers(org?.longStayDiscounts),
  };
}
