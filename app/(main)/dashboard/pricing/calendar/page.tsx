import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { loadUnitPriceRows, SEASON_ROW_PREFIX } from "@/lib/unit-prices";
import { resolvePrice, applyWeekend, weekendRuleOf } from "@/lib/pricing";

/**
 * Pricing → Rate calendar: units × days, each cell = the nightly rate the
 * pricing engine would charge (same loader + resolvePrice as reservations),
 * coloured by the season that sets it. Server-rendered; navigation via links.
 */
const DAY = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function RateCalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; days?: string; building?: string }> }) {
  const sp = await searchParams;
  const { organizationId } = await requireOrgUser();
  const [t, locale, accessible, selected] = await Promise.all([getTranslations("pricing.calendar"), getLocale(), getSessionAccessibleProperties(), getSelectedPropertyId()]);

  const days = sp.days === "30" ? 30 : 14;
  const todayYmd = ymd(new Date());
  const from = new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : todayYmd}T00:00:00.000Z`);
  const dates = Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * DAY));

  const buildings = await prisma.property.findMany({
    where: { organizationId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const building = sp.building !== undefined ? sp.building : selected || "";
  const buildingIds = building && buildings.some((b) => b.id === building) ? [building] : buildings.map((b) => b.id);

  const [units, seasons, org] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: { in: buildingIds }, isActive: true },
      select: { id: true, name: true, basePrice: true, property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { floor: "asc" }, { name: "asc" }],
    }),
    prisma.season.findMany({ where: { organizationId }, select: { id: true, name: true, nameAr: true, color: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { weekendDays: true, weekendAdjustPct: true } }),
  ]);
  const weekend = weekendRuleOf(org);
  // shaded columns = the organization's weekend nights (Thu/Fri until configured)
  const weekendDays = org && org.weekendDays.length > 0 ? org.weekendDays : [4, 5];
  let anyWeekendRate = false;
  const rows = await loadUnitPriceRows(units.map((u) => u.id));
  const seasonById = new Map(seasons.map((s) => [s.id, s]));

  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({ from: ymd(from), days: String(days), building, ...o });
    return `/dashboard/pricing/calendar?${p.toString()}`;
  };
  const shift = (n: number) => ymd(new Date(from.getTime() + n * DAY));
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const usedSeasons = new Map<string, { name: string; color: string }>();

  const grid = units.map((u) => {
    const prices = rows.get(u.id) ?? [];
    return {
      unit: u,
      cells: dates.map((d) => {
        const p = resolvePrice(prices, d, Number(u.basePrice));
        const night = applyWeekend(p, d, weekend);
        if (night.weekend) anyWeekendRate = true;
        let color: string | null = null;
        if (p?.priceType === "SEASONAL") {
          const s = p.priceId.startsWith(SEASON_ROW_PREFIX) ? seasonById.get(p.priceId.slice(SEASON_ROW_PREFIX.length)) : null;
          color = s?.color ?? "#F59E0B";
          const name = (locale === "ar" && s?.nameAr) || s?.name || p.name || "";
          usedSeasons.set(color + name, { name, color });
        }
        return { rate: p ? night.rate : null, name: p ? night.name : null, color, weekend: night.weekend };
      }),
    };
  });

  const linkBtn = "inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={qs({ from: shift(-days) })} className={linkBtn}><ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" /> {t("prev")}</Link>
        <Link href={qs({ from: todayYmd })} className={linkBtn}>{t("today")}</Link>
        <Link href={qs({ from: shift(days) })} className={linkBtn}>{t("next")} <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" /></Link>
        <span className="mx-1 text-sm font-semibold text-gray-800">{monthFmt.format(from)}</span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {[14, 30].map((n) => (
            <Link key={n} href={qs({ days: String(n) })} className={`${linkBtn} ${days === n ? "border-brand-500 text-brand-700" : ""}`}>{n} {t("days")}</Link>
          ))}
          <div className="flex flex-wrap gap-1">
            <Link href={qs({ building: "" })} className={`${linkBtn} ${building === "" ? "border-brand-500 text-brand-700" : ""}`}>{t("all")}</Link>
            {buildings.map((b) => (
              <Link key={b.id} href={qs({ building: b.id })} className={`${linkBtn} ${building === b.id ? "border-brand-500 text-brand-700" : ""}`}>{b.name}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-white ring-1 ring-gray-300" /> {t("legendDefault")}</span>
        {[...usedSeasons.values()].map((s) => (
          <span key={s.color + s.name} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: s.color }} /> {s.name}</span>
        ))}
        {anyWeekendRate && <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-brand-700">*</span> {t("legendWeekend")}</span>}
        <span className="ms-auto text-gray-400">{t("omr")}</span>
      </div>

      {grid.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{t("empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky start-0 z-10 min-w-[160px] bg-gray-50 px-3 py-2 text-start font-medium" />
                {dates.map((d) => {
                  const wk = d.getUTCDay();
                  return (
                    <th key={ymd(d)} className={`min-w-[64px] px-1 py-2 text-center font-medium ${ymd(d) === todayYmd ? "text-brand-700" : ""} ${weekendDays.includes(wk) ? "bg-gray-100" : ""}`}>
                      {dayFmt.format(d)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grid.map(({ unit, cells }) => (
                <tr key={unit.id} className="border-t border-gray-100">
                  <th className="sticky start-0 z-10 bg-white px-3 py-1.5 text-start font-medium text-gray-900">
                    {unit.name}
                    <span className="block text-[10px] font-normal text-gray-400">{unit.property.name}</span>
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      title={c.name ?? undefined}
                      className="border-s border-gray-100 px-1 py-1.5 text-center tabular-nums"
                      style={c.color ? { backgroundColor: `${c.color}26`, boxShadow: `inset 0 -2px 0 ${c.color}` } : undefined}
                      dir="ltr"
                    >
                      {c.rate === null ? "—" : Number.isInteger(c.rate) ? c.rate : c.rate.toFixed(3).replace(/0+$/, "")}
                      {c.weekend && <span className="font-semibold text-brand-700">*</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
