import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { seasonYmd, fmtRate, SEASON_COLORS } from "@/lib/pricing-management";
import SeasonForm, { type SeasonFormInitial } from "./SeasonForm";

/** Create (/seasons/new) or edit a central season. */
export default async function SeasonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizationId } = await requireOrgUser();
  const access = await getSessionAccess();
  if (!access?.can("units", "EDIT")) redirect("/dashboard/pricing/seasons");
  const t = await getTranslations("pricing.form");
  const accessible = await getSessionAccessibleProperties();

  const [season, buildings, units] = await Promise.all([
    id === "new" ? null : prisma.season.findFirst({ where: { id, organizationId }, include: { rates: true } }),
    prisma.property.findMany({
      where: { organizationId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId, isArchived: false }, isActive: true },
      select: { id: true, name: true, unitType: true, propertyId: true, basePrice: true, prices: { where: { priceType: "DEFAULT" }, select: { dailyRate: true }, take: 1 } },
      orderBy: [{ property: { name: "asc" } }, { floor: "asc" }, { name: "asc" }],
    }),
  ]);
  if (id !== "new" && !season) notFound();

  const initial: SeasonFormInitial = season
    ? {
        id: season.id, name: season.name, nameAr: season.nameAr ?? "",
        startDate: seasonYmd(season.startDate), endDate: seasonYmd(season.endDate),
        priority: season.priority, isActive: season.isActive, disallowMonthly: season.disallowMonthly, color: season.color,
        propertyIds: season.propertyIds, excludedUnitIds: season.excludedUnitIds,
        typeRates: Object.fromEntries(
          season.rates.filter((r) => r.unitType).map((r) => [r.unitType!, { daily: fmtRate(r.dailyRate), weekly: fmtRate(r.weeklyRate), monthly: fmtRate(r.monthlyRate) }]),
        ),
        unitRates: Object.fromEntries(
          season.rates.filter((r) => r.unitId).map((r) => [r.unitId!, { daily: fmtRate(r.dailyRate), weekly: fmtRate(r.weeklyRate), monthly: fmtRate(r.monthlyRate) }]),
        ),
        minNights: season.minNights, weekendAdjustPct: season.weekendAdjustPct,
        publicPage: season.publicPage, descriptionEn: season.descriptionEn ?? "", descriptionAr: season.descriptionAr ?? "",
      }
    : {
        name: "", nameAr: "", startDate: "", endDate: "", priority: 10, isActive: true, disallowMonthly: false,
        color: SEASON_COLORS[0], propertyIds: [], excludedUnitIds: [], typeRates: {}, unitRates: {}, minNights: null, weekendAdjustPct: null,
        publicPage: false, descriptionEn: "", descriptionAr: "",
      };

  return (
    <SeasonForm
      title={season ? t("editTitle") : t("newTitle")}
      initial={initial}
      buildings={buildings}
      units={units.map((u) => ({
        id: u.id, name: u.name, unitType: u.unitType, propertyId: u.propertyId,
        defaultDaily: fmtRate(u.prices[0]?.dailyRate ?? u.basePrice),
      }))}
    />
  );
}
