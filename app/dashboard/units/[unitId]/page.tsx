import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  HomeModernIcon,
  PencilSquareIcon,
  WrenchScrewdriverIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ChatBubbleLeftIcon,
  BuildingOffice2Icon,
  BoltIcon,
  ListBulletIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { getUnitDisplayStatus, UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import UnitPricingSection from "@/components/dashboard/units/UnitPricingSection";
import UnitNotesSection   from "@/components/dashboard/units/UnitNotesSection";

function fmt(v: any) {
  return `${Number(v).toFixed(3)} OMR`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const [unit, prices, notes, recentPayments] = await Promise.all([
    prisma.unit.findUnique({
      where:   { id: unitId },
      include: {
        property:     { select: { id: true, name: true, organizationId: true } },
        reservations: {
          where:   { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
          include: {
            tenant: { select: { firstName: true, lastName: true, phone: true } },
          },
          orderBy: { startDate: "asc" },
        },
      },
    }),

    prisma.unitPrice.findMany({
      where:   { unitId },
      orderBy: [{ priceType: "asc" }, { startDate: "asc" }],
    }),

    prisma.unitNote.findMany({
      where:   { unitId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),

    // Most recent payments tied to a reservation that currently has this unit
    // attached via the reservationUnits junction table (i.e. the active stay).
    // The legacy `reservation.unitId` FK still points to the FIRST unit ever
    // booked, so after a move it would mis-attribute payments to the old
    // unit. The junction-table filter excludes moved-out RUs and follows the
    // guest to whichever unit they're actually in.
    prisma.payment.findMany({
      where: {
        reservation: {
          reservationUnits: {
            some: { unitId, isMovedOut: { not: true } },
          },
        },
      },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true } },
        reservation: { select: { id: true, reservationNumber: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  if (!unit || unit.property.organizationId !== dbUser.organizationId) notFound();

  const displayStatus = getUnitDisplayStatus(unit.status, unit.reservations);
  const cfg           = UNIT_STATUS_CONFIG[displayStatus];
  const activeRes     = unit.reservations.find((r) => r.status === "CHECKED_IN");
  const upcomingRes   = unit.reservations.filter((r) => r.status !== "CHECKED_IN");

  const t             = await getTranslations("units.detail");
  const tTypesLong    = await getTranslations("units.typesLong");
  const tAmen         = await getTranslations("units.amenities");
  const tStatus       = await getTranslations("units.displayStatus");
  const locale        = await getLocale();
  const dfLocale      = locale === "ar" ? arLocale : enLocale;
  const fmtDay        = (d: Date) => format(d, "dd MMM yyyy", { locale: dfLocale });
  const fmtDayShort   = (d: Date) => format(d, "dd MMM",       { locale: dfLocale });

  let typeLabel = unit.unitType;
  try { typeLabel = tTypesLong(unit.unitType as never); } catch {}
  let statusLabel = cfg.label;
  try { statusLabel = tStatus(displayStatus as never); } catch {}

  // Serialize Decimal → string for client components
  const serializedPrices = prices.map((p) => ({
    id:          p.id,
    priceType:   p.priceType,
    name:        p.name,
    dailyRate:   p.dailyRate.toString(),
    weeklyRate:  p.weeklyRate?.toString() ?? null,
    monthlyRate: p.monthlyRate.toString(),
    startDate:   p.startDate?.toISOString() ?? null,
    endDate:     p.endDate?.toISOString()   ?? null,
    priority:    p.priority,
    isActive:    p.isActive,
  }));

  const serializedNotes = notes.map((n) => ({
    id:        n.id,
    content:   n.content,
    createdAt: n.createdAt.toISOString(),
    user:      n.user,
  }));

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/dashboard/properties" className="hover:text-blue-600 transition-colors">{t("breadcrumbProperties")}</Link>
        <span>/</span>
        <Link href={`/dashboard/properties/${unit.property.id}`} className="hover:text-blue-600 transition-colors">
          {unit.property.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{unit.name}</span>
      </nav>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <HomeModernIcon className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{unit.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {typeLabel}
              {" · "}
              <span className="ltr-numbers">{t("bedsBathsShort", { beds: unit.bedrooms, baths: unit.bathrooms })}</span>
              {unit.area ? <> · <span className="ltr-numbers">{unit.area} m²</span></> : ""}
              {unit.floor > 0 ? <> · {t("floorN", { n: unit.floor })}</> : <> · {t("groundFloor")}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/units"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <ListBulletIcon className="h-4 w-4" />
            {t("unitsList")}
          </Link>
          <Link
            href={`/dashboard/units/${unitId}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {t("edit")}
          </Link>
          <Link
            href={`/dashboard/reservations/new?unitId=${unitId}`}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 shadow-sm transition-colors"
          >
            <CalendarDaysIcon className="h-4 w-4" />
            {t("newReservation")}
          </Link>
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left: Details + Reservations */}
        <div className="space-y-5 lg:col-span-2">

          {/* Unit Details Card */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
              {t("unitDetails")}
            </h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-400">{t("type")}</p>
                <p className="font-medium text-gray-800">{typeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t("floor")}</p>
                <p className="font-medium text-gray-800 ltr-numbers">{unit.floor > 0 ? t("floorN", { n: unit.floor }) : t("ground")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t("area")}</p>
                <p className="font-medium text-gray-800 ltr-numbers">{unit.area ? `${unit.area} m²` : t("dash")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t("bedrooms")}</p>
                <p className="font-medium text-gray-800 ltr-numbers">{unit.bedrooms}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t("bathrooms")}</p>
                <p className="font-medium text-gray-800 ltr-numbers">{unit.bathrooms}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t("basePrice")}</p>
                <p className="font-medium text-gray-800 ltr-numbers">{t("perMonth", { amount: fmt(unit.basePrice) })}</p>
              </div>
            </div>

            {unit.description && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">{t("description")}</p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{unit.description}</p>
              </div>
            )}

            {unit.amenities.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs text-gray-400 flex items-center gap-1">
                  <BoltIcon className="h-3.5 w-3.5" /> {t("amenities")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unit.amenities.map((a) => {
                    let label = a;
                    try { label = tAmen(a as never); } catch {}
                    return (
                      <span key={a} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Active Reservation */}
          {activeRes && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <UserGroupIcon className="h-4 w-4" />
                {t("currentlyOccupied")}
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {activeRes.tenant.firstName} {activeRes.tenant.lastName}
                  </p>
                  <p className="text-xs text-gray-500 ltr-numbers">{activeRes.tenant.phone}</p>
                  <p className="mt-1 text-xs text-gray-500 ltr-numbers">
                    {fmtDay(new Date(activeRes.startDate))}
                    {" → "}
                    {fmtDay(new Date(activeRes.endDate))}
                  </p>
                </div>
                <Link
                  href={`/dashboard/reservations/${activeRes.id}`}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  {t("viewReservation")}
                </Link>
              </div>
            </section>
          )}

          {/* Upcoming Reservations */}
          {upcomingRes.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                {t("upcomingReservations")}
              </h2>
              <div className="space-y-2">
                {upcomingRes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {r.tenant.firstName} {r.tenant.lastName}
                      </p>
                      <p className="text-xs text-gray-500 ltr-numbers">
                        {fmtDayShort(new Date(r.startDate))}
                        {" → "}
                        {fmtDay(new Date(r.endDate))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {r.status === "CONFIRMED" ? t("confirmed") : t("pending")}
                      </span>
                      <Link
                        href={`/dashboard/reservations/${r.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t("view")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Transactions */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <BanknotesIcon className="h-4 w-4 text-gray-400" />
              {t("recentTransactions")}
              {recentPayments.length > 0 && (
                <span className="ms-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 ltr-numbers">
                  {recentPayments.length}
                </span>
              )}
            </h2>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noTransactions")}</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-start font-medium px-5 py-2">{t("txDate")}</th>
                      <th className="text-start font-medium px-3 py-2">{t("txTenant")}</th>
                      <th className="text-end   font-medium px-3 py-2">{t("txAmount")}</th>
                      <th className="text-start font-medium px-3 py-2 hidden sm:table-cell">{t("txMethod")}</th>
                      <th className="text-start font-medium px-5 py-2 hidden md:table-cell">{t("txReservation")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-2.5 text-gray-700 ltr-numbers whitespace-nowrap">
                          {fmtDay(p.date)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/dashboard/tenants/${p.tenant.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {p.tenant.firstName} {p.tenant.lastName}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-end font-semibold text-emerald-700 ltr-numbers whitespace-nowrap">
                          {fmt(p.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">
                          {p.method}
                        </td>
                        <td className="px-5 py-2.5 hidden md:table-cell">
                          {p.reservation && (
                            <Link
                              href={`/dashboard/reservations/${p.reservation.id}`}
                              className="font-mono text-xs text-blue-600 hover:underline ltr-numbers"
                            >
                              {p.reservation.reservationNumber ?? p.reservation.id.slice(0, 8)}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <ChatBubbleLeftIcon className="h-4 w-4 text-gray-400" />
              {t("internalNotes")}
              {notes.length > 0 && (
                <span className="ms-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 ltr-numbers">
                  {notes.length}
                </span>
              )}
            </h2>
            <UnitNotesSection
              unitId={unitId}
              notes={serializedNotes}
              currentUserId={dbUser.id}
            />
          </section>
        </div>

        {/* Right: Pricing */}
        <div>
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
              {t("pricing")}
            </h2>
            <UnitPricingSection unitId={unitId} prices={serializedPrices} />
          </section>
        </div>
      </div>
    </div>
  );
}
