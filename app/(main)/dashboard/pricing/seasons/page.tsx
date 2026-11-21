import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlusIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { seasonYmd, fmtRate } from "@/lib/pricing-management";
import SeasonRowActions from "./SeasonRowActions";

/** Pricing → Seasons: org-wide seasons, which buildings/units they cover, rate range, overlaps. */
export default async function SeasonsPage() {
  const { organizationId } = await requireOrgUser();
  const [access, t, locale, selected] = await Promise.all([
    getSessionAccess(),
    getTranslations("pricing.seasons"),
    getLocale(),
    getSelectedPropertyId(),
  ]);
  const canEdit = !!access?.can("units", "EDIT");
  const scope = await getEffectivePropertyIds(selected || undefined); // null = all buildings

  const [seasons, units, buildings] = await Promise.all([
    prisma.season.findMany({ where: { organizationId }, include: { rates: true }, orderBy: [{ startDate: "desc" }, { priority: "desc" }] }),
    prisma.unit.findMany({ where: { property: { organizationId }, isActive: true }, select: { id: true, unitType: true, propertyId: true } }),
    prisma.property.findMany({ where: { organizationId }, select: { id: true, name: true } }),
  ]);
  const buildingName = new Map(buildings.map((b) => [b.id, b.name]));

  // units a season applies to (same rule as lib/unit-prices.ts)
  const unitsOf = (s: (typeof seasons)[number]) =>
    units.filter(
      (u) =>
        (s.propertyIds.length === 0 || s.propertyIds.includes(u.propertyId)) &&
        !s.excludedUnitIds.includes(u.id) &&
        s.rates.some((r) => r.unitId === u.id || (r.unitId === null && r.unitType === u.unitType)),
    );

  // property selector: show seasons that touch the selected building(s)
  const visible = seasons.filter((s) => !scope || unitsOf(s).some((u) => scope.includes(u.propertyId)) || s.propertyIds.length === 0);

  const today = new Date().toISOString().slice(0, 10);
  const fmtDate = (d: Date) => new Date(d).toLocaleDateString(locale === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const overlaps = (a: (typeof seasons)[number]) =>
    seasons.some((b) => {
      if (b.id === a.id || !a.isActive || !b.isActive || b.startDate > a.endDate || b.endDate < a.startDate) return false;
      const ua = new Set(unitsOf(a).map((u) => u.id));
      return unitsOf(b).some((u) => ua.has(u.id));
    });

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Link href="/dashboard/pricing/seasons/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            <PlusIcon className="h-4 w-4" /> {t("new")}
          </Link>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("colName")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colDates")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colBuildings")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("colUnits")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("colRates")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("colPriority")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((s) => {
                const inSeason = unitsOf(s);
                const dailies = s.rates.map((r) => Number(r.dailyRate));
                const lo = Math.min(...dailies), hi = Math.max(...dailies);
                const start = seasonYmd(s.startDate), end = seasonYmd(s.endDate);
                const when = end < today ? "past" : start <= today ? "current" : "upcoming";
                const name = locale === "ar" && s.nameAr ? s.nameAr : s.name;
                return (
                  <tr key={s.id} className={s.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-none rounded-full" style={{ backgroundColor: s.color }} />
                        <Link href={`/dashboard/pricing/seasons/${s.id}`} className="font-semibold text-gray-900 hover:text-brand-600">{name}</Link>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${when === "current" ? "bg-green-50 text-green-700" : when === "upcoming" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{t(when)}</span>
                        {!s.isActive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{t("inactive")}</span>}
                        {s.disallowMonthly && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{t("noMonthly")}</span>}
                        {overlaps(s) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-orange-700" title={t("overlap")}>
                            <ExclamationTriangleIcon className="h-3 w-3" /> {t("overlap")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(s.startDate)} – {fmtDate(s.endDate)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {s.propertyIds.length === 0
                        ? t("allBuildings")
                        : s.propertyIds.length <= 2
                          ? s.propertyIds.map((id) => buildingName.get(id) ?? "—").join(", ")
                          : t("nBuildings", { n: s.propertyIds.length })}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{inSeason.length}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums" dir="ltr">
                      {dailies.length ? (lo === hi ? fmtRate(lo) : `${fmtRate(lo)} – ${fmtRate(hi)}`) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{s.priority}</td>
                    <td className="px-4 py-3 text-end">
                      <SeasonRowActions id={s.id} canEdit={canEdit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
