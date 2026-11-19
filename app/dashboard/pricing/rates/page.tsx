import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { fmtRate } from "@/lib/pricing-management";
import RatesEditor from "./RatesEditor";

/** Pricing → Default rates: every unit's DEFAULT daily / weekly / monthly rate in one editable table. */
export default async function DefaultRatesPage() {
  const { organizationId } = await requireOrgUser();
  const [access, accessible, selected] = await Promise.all([getSessionAccess(), getSessionAccessibleProperties(), getSelectedPropertyId()]);

  const [buildings, units] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) }, isActive: true },
      select: {
        id: true, name: true, unitType: true, propertyId: true, basePrice: true,
        prices: { where: { priceType: "DEFAULT" }, select: { dailyRate: true, weeklyRate: true, monthlyRate: true }, take: 1 },
      },
      orderBy: [{ property: { name: "asc" } }, { floor: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <RatesEditor
      canEdit={!!access?.can("units", "EDIT")}
      buildings={buildings}
      initialBuilding={selected && buildings.some((b) => b.id === selected) ? selected : ""}
      units={units.map((u) => {
        const d = u.prices[0];
        return {
          id: u.id, name: u.name, unitType: u.unitType, propertyId: u.propertyId,
          hasDefault: !!d,
          daily: d ? fmtRate(d.dailyRate) : fmtRate(u.basePrice),
          weekly: d ? fmtRate(d.weeklyRate) : "",
          monthly: d ? fmtRate(d.monthlyRate) : "",
        };
      })}
    />
  );
}
