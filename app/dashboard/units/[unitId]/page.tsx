import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import { getSessionAccess, assertView } from "@/lib/access";
import { Prisma } from "@prisma/client";
import {
  HomeModernIcon,
  PencilSquareIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  ChatBubbleLeftIcon,
  BuildingOffice2Icon,
  BoltIcon,
  UserIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import { getUnitDisplayStatus, UNIT_STATUS_CONFIG } from "@/lib/unit-status";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";
import UnitPricingSection from "@/components/dashboard/units/UnitPricingSection";
import UnitNotesSection   from "@/components/dashboard/units/UnitNotesSection";
import TransactionsPanel from "@/components/dashboard/transactions/TransactionsPanel";
import type { TransactionData } from "@/components/dashboard/transactions/TransactionSections";

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

  await assertView("units");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true, organization: { select: { showReservedStatus: true } } },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");
  const showReserved = dbUser.organization?.showReservedStatus ?? false;

  // A unit is attached to a reservation via the new ReservationUnit junction
  // table OR the legacy Reservation.unitId FK. Match on either so older data
  // and post-move reservations are both found.
  const reservationWhereForUnit: Prisma.ReservationWhereInput = {
    OR: [
      { unitId },
      { reservationUnits: { some: { unitId } } },
    ],
  };

  const [unit, prices, notes, txnReservations, txnInvoices, txnPayments, resCount, invCount, payCount] =
    await Promise.all([
    prisma.unit.findUnique({
      where:   { id: unitId },
      include: {
        property:     { select: { id: true, name: true, organizationId: true } },
        reservations: {
          where:   { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
          select:  {
            id: true, reservationNumber: true, status: true, startDate: true, endDate: true,
            tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
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

    // ── Transactions for this unit (latest 50 each; counts queried separately) ──
    prisma.reservation.findMany({
      where:   reservationWhereForUnit,
      include: {
        reservationUnits: { include: { unit: { select: { name: true } } } },
        unit:             { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
      take: 50,
    }),

    prisma.invoice.findMany({
      where:   { reservation: reservationWhereForUnit, status: { not: "VOID" } },
      orderBy: { issueDate: "desc" },
      take: 50,
    }),

    // Payments follow the guest via the junction table (moved-out RUs excluded).
    prisma.payment.findMany({
      where: {
        reservation: { reservationUnits: { some: { unitId, isMovedOut: { not: true } } } },
      },
      include: { reservation: { select: { id: true, reservationNumber: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),

    prisma.reservation.count({ where: reservationWhereForUnit }),
    prisma.invoice.count({ where: { reservation: reservationWhereForUnit, status: { not: "VOID" } } }),
    prisma.payment.count({ where: { reservation: { reservationUnits: { some: { unitId, isMovedOut: { not: true } } } } } }),
  ]);

  if (!unit || unit.property.organizationId !== dbUser.organizationId) notFound();

  // Building scope: block units outside the user's assigned buildings.
  const acc = await getSessionAccessibleProperties();
  if (acc && !acc.includes(unit.propertyId)) redirect("/dashboard/no-access");
  const canEditUnit = (await getSessionAccess())?.canEdit("units") ?? false;

  const displayStatus = getUnitDisplayStatus(unit.status, unit.reservations, new Date(), { showReserved, isActive: unit.isActive });
  const cfg           = UNIT_STATUS_CONFIG[displayStatus];

  // Current in-house stay (for the "Current stay" card) — the checked-in reservation.
  const checkedInRes = unit.reservations.find((r) => r.status === "CHECKED_IN");
  const currentStay = checkedInRes
    ? {
        reservationId: checkedInRes.id,
        reservationNumber: checkedInRes.reservationNumber,
        tenantId: checkedInRes.tenant.id,
        tenantName: `${checkedInRes.tenant.firstName} ${checkedInRes.tenant.lastName}`.trim(),
        tenantPhone: checkedInRes.tenant.phone,
        startDate: checkedInRes.startDate.toISOString(),
        endDate: checkedInRes.endDate.toISOString(),
      }
    : null;

  // Build the serialized transaction data for the shared panel.
  const unitNameFor = (r: (typeof txnReservations)[number]) =>
    r.reservationUnits.map((ru) => ru.unit.name).join(", ") || r.unit?.name || null;

  const txnData: TransactionData = {
    currency: "OMR",
    counts: { reservations: resCount, invoices: invCount, payments: payCount },
    reservations: txnReservations.map((r) => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      status: r.status,
      displayStatus: getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate).label,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      unitLabel: unitNameFor(r),
      grandTotal: Number(r.grandTotal ?? 0),
    })),
    invoices: txnInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      dueDate: i.dueDate.toISOString(),
      issueDate: i.issueDate?.toISOString() ?? null,
      totalAmount: Number(i.totalAmount),
      amountPaid: Number(i.amountPaid),
      balanceDue: Number(i.balanceDue),
      reservationId: i.reservationId,
    })),
    payments: txnPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      date: p.date.toISOString(),
      reference: p.reference,
      isRefund: p.isRefund,
      reservationId: p.reservationId,
      reservationNumber: p.reservation?.reservationNumber ?? null,
    })),
  };

  const t             = await getTranslations("units.detail");
  const tTypesLong    = await getTranslations("units.typesLong");
  const tAmen         = await getTranslations("units.amenities");
  const tStatus       = await getTranslations("units.displayStatus");

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
    disallowMonthly: p.disallowMonthly,
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
          {canEditUnit && (
          <Link
            href={`/dashboard/units/${unitId}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {t("edit")}
          </Link>
          )}
          <Link
            href={`/dashboard/reservations/new?unitId=${unitId}`}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 shadow-sm transition-colors"
          >
            <CalendarDaysIcon className="h-4 w-4" />
            {t("newReservation")}
          </Link>
        </div>
      </div>

      {/* ── Current stay (when occupied) ───────────────────────────────── */}
      {currentStay && (
        <Link
          href={`/dashboard/reservations/${currentStay.reservationId}`}
          className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/60 px-5 py-4 transition-colors hover:bg-blue-50"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <UserIcon className="h-5 w-5 text-blue-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{t("currentStay")}</p>
              <p className="truncate text-sm font-bold text-gray-900">{currentStay.tenantName}</p>
              <p className="text-xs text-gray-500 ltr-numbers">
                {new Date(currentStay.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                {" → "}
                {new Date(currentStay.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                {currentStay.reservationNumber ? <> · {currentStay.reservationNumber}</> : null}
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 text-sm font-medium text-blue-600">{t("viewReservation")} →</span>
        </Link>
      )}

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

          {/* Reservations · Invoices · Payments */}
          <TransactionsPanel data={txnData} />

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
