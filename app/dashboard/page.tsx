import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import {
  BanknotesIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  PlusIcon,
  HomeModernIcon,
} from "@heroicons/react/24/outline";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOMR(amount: unknown) {
  return `${Number(amount ?? 0).toFixed(3)} OMR`;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CHECKED_IN: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
  DUE: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  VOID: "bg-gray-100 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DUE: "Overdue",
  PAID: "Paid",
  PARTIAL: "Partial",
  VOID: "Void",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Avatar({
  first,
  last,
  color = "gray",
}: {
  first: string;
  last: string;
  color?: "gray" | "green" | "orange" | "blue";
}) {
  const colorMap = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div
      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}
    >
      <span className="text-sm font-semibold">
        {first[0]}
        {last[0]}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardOverview() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, firstName: true },
  });
  const orgId = dbUser?.organizationId!;

  // ── Date ranges ──
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  );
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── Parallel data fetch ──
  const [
    totalProperties,
    totalUnits,
    occupiedUnits,
    activeTenants,
    paymentsThisMonth,
    expensesThisMonth,
    overdueInvoices,
    todayArrivals,
    todayDepartures,
    recentReservations,
    recentPayments,
  ] = await Promise.all([
    prisma.property.count({ where: { organizationId: orgId } }),

    prisma.unit.count({
      where: { property: { organizationId: orgId } },
    }),

    prisma.reservation.count({
      where: {
        unit: { property: { organizationId: orgId } },
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
      },
    }),

    prisma.tenant.count({ where: { organizationId: orgId } }),

    prisma.payment.aggregate({
      where: {
        reservation: { unit: { property: { organizationId: orgId } } },
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),

    prisma.expense.aggregate({
      where: {
        property: { organizationId: orgId },
        date: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),

    prisma.invoice.findMany({
      where: {
        status: "DUE",
        reservation: { unit: { property: { organizationId: orgId } } },
      },
      include: {
        reservation: {
          include: {
            tenant: { select: { firstName: true, lastName: true } },
            unit: {
              select: { name: true, property: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),

    prisma.reservation.findMany({
      where: {
        unit: { property: { organizationId: orgId } },
        startDate: { gte: todayStart, lte: todayEnd },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      include: {
        tenant: {
          select: { firstName: true, lastName: true, phone: true },
        },
        unit: {
          select: { name: true, property: { select: { name: true } } },
        },
      },
      orderBy: { startDate: "asc" },
    }),

    prisma.reservation.findMany({
      where: {
        unit: { property: { organizationId: orgId } },
        endDate: { gte: todayStart, lte: todayEnd },
        status: "CHECKED_IN",
      },
      include: {
        tenant: {
          select: { firstName: true, lastName: true, phone: true },
        },
        unit: {
          select: { name: true, property: { select: { name: true } } },
        },
      },
      orderBy: { endDate: "asc" },
    }),

    prisma.reservation.findMany({
      where: { unit: { property: { organizationId: orgId } } },
      include: {
        tenant: { select: { firstName: true, lastName: true } },
        unit: {
          select: { name: true, property: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),

    prisma.payment.findMany({
      where: {
        reservation: { unit: { property: { organizationId: orgId } } },
      },
      include: {
        tenant: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  // ── Calculations ──
  const revenue = Number(paymentsThisMonth._sum.amount || 0);
  const expenses = Number(expensesThisMonth._sum.amount || 0);
  const netIncome = revenue - expenses;
  const occupancyRate =
    totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : "0";
  const occupancyPct = Math.min(Number(occupancyRate), 100);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = dbUser?.firstName ?? "there";

  // ── UI ──
  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {userName}!
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {format(now, "EEEE, MMMM d, yyyy")} — here&apos;s what&apos;s
            happening today
          </p>
        </div>

        {/* Quick-action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/reservations/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Reservation
          </Link>
          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <BanknotesIcon className="h-4 w-4" />
            Record Payment
          </Link>
          <Link
            href="/dashboard/tenants/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <UserGroupIcon className="h-4 w-4" />
            Add Tenant
          </Link>
        </div>
      </div>

      {/* ── Overdue alert ── */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {overdueInvoices.length} overdue invoice
              {overdueInvoices.length > 1 ? "s" : ""} need attention
            </p>
            <p className="text-sm text-red-700">
              Review the invoices below and collect payment from the tenants.
            </p>
          </div>
          <Link
            href="/dashboard/payments/new"
            className="flex-shrink-0 text-sm font-semibold text-red-700 hover:text-red-900"
          >
            Record payment →
          </Link>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Monthly Revenue */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Monthly Revenue</p>
            <div className="rounded-lg bg-green-100 p-2">
              <BanknotesIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatOMR(revenue)}
          </p>
          <p className="mt-1 text-xs text-gray-400">{format(now, "MMMM yyyy")}</p>
        </div>

        {/* Net Income */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Net Income</p>
            <div
              className={`rounded-lg p-2 ${netIncome >= 0 ? "bg-emerald-100" : "bg-red-100"}`}
            >
              <ArrowTrendingUpIcon
                className={`h-5 w-5 ${netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${netIncome >= 0 ? "text-gray-900" : "text-red-600"}`}
          >
            {formatOMR(netIncome)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            After {formatOMR(expenses)} expenses
          </p>
        </div>

        {/* Occupancy */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Occupancy Rate</p>
            <div className="rounded-lg bg-blue-100 p-2">
              <HomeModernIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{occupancyRate}%</p>
          <p className="mt-1 text-xs text-gray-400">
            {occupiedUnits} of {totalUnits} units occupied
          </p>
        </div>

        {/* Today's schedule */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Today&apos;s Schedule
            </p>
            <div className="rounded-lg bg-purple-100 p-2">
              <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <div className="flex items-end gap-5">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {todayArrivals.length}
              </p>
              <p className="text-xs font-medium text-green-600">Arrivals</p>
            </div>
            <div className="mb-1 h-8 w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {todayDepartures.length}
              </p>
              <p className="text-xs font-medium text-orange-600">Departures</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column (2/3) ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Arrivals Today */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Arrivals Today
                </h3>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {todayArrivals.length}
                </span>
              </div>
              <Link
                href="/dashboard/reservations"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                All reservations
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>

            {todayArrivals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircleIcon className="mb-2 h-9 w-9 text-gray-200" />
                <p className="text-sm text-gray-400">
                  No arrivals scheduled for today
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {todayArrivals.map((res) => (
                  <li
                    key={res.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        first={res.tenant.firstName}
                        last={res.tenant.lastName}
                        color="green"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {res.tenant.firstName} {res.tenant.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {res.unit?.property.name ?? "—"} — {res.unit?.name ?? "Multiple Units"}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-3">
                      {res.tenant.phone && (
                        <span className="hidden text-xs text-gray-400 sm:block">
                          {res.tenant.phone}
                        </span>
                      )}
                      <StatusBadge status={res.status} />
                      <Link
                        href={`/dashboard/reservations/${res.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Departures Today */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Departures Today
                </h3>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {todayDepartures.length}
                </span>
              </div>
            </div>

            {todayDepartures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircleIcon className="mb-2 h-9 w-9 text-gray-200" />
                <p className="text-sm text-gray-400">
                  No departures scheduled for today
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {todayDepartures.map((res) => (
                  <li
                    key={res.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        first={res.tenant.firstName}
                        last={res.tenant.lastName}
                        color="orange"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {res.tenant.firstName} {res.tenant.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {res.unit?.property.name ?? "—"} — {res.unit?.name ?? "Multiple Units"}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-3">
                      {res.tenant.phone && (
                        <span className="hidden text-xs text-gray-400 sm:block">
                          {res.tenant.phone}
                        </span>
                      )}
                      <StatusBadge status={res.status} />
                      <Link
                        href={`/dashboard/reservations/${res.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Reservations */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Recent Reservations
              </h3>
              <Link
                href="/dashboard/reservations"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                View all
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
            {recentReservations.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No reservations yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentReservations.map((res) => (
                  <li
                    key={res.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        first={res.tenant.firstName}
                        last={res.tenant.lastName}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {res.tenant.firstName} {res.tenant.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {res.unit?.property.name ?? "—"} · {res.unit?.name ?? "Multiple Units"} ·{" "}
                          {format(new Date(res.startDate), "MMM d")} →{" "}
                          {format(new Date(res.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-center gap-3">
                      <StatusBadge status={res.status} />
                      <Link
                        href={`/dashboard/reservations/${res.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right sidebar (1/3) ── */}
        <div className="space-y-6">
          {/* Overdue Invoices */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Overdue Invoices
                </h3>
                {overdueInvoices.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {overdueInvoices.length}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/payments"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                All
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>

            {overdueInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircleIcon className="mb-2 h-9 w-9 text-green-300" />
                <p className="text-sm text-gray-400">All invoices paid</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {overdueInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="px-4 py-3 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {inv.reservation.tenant.firstName}{" "}
                          {inv.reservation.tenant.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {inv.reservation.unit?.property.name ?? "—"} ·{" "}
                          {inv.reservation.unit?.name ?? "Multiple Units"}
                        </p>
                        <p className="mt-0.5 text-xs text-red-500">
                          Due {format(new Date(inv.dueDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold text-red-700">
                          {formatOMR(inv.amount)}
                        </p>
                        <Link
                          href="/dashboard/payments/new"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Pay →
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Payments */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Recent Payments
              </h3>
              <Link
                href="/dashboard/payments"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                All
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>

            {recentPayments.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No payments recorded yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentPayments.map((pay) => (
                  <li
                    key={pay.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {pay.tenant.firstName} {pay.tenant.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {METHOD_LABELS[pay.method] ?? pay.method} ·{" "}
                        {format(new Date(pay.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <p className="ml-3 flex-shrink-0 text-sm font-semibold text-green-700">
                      +{formatOMR(pay.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Portfolio summary */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
            <div className="mb-4 flex items-center gap-2">
              <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Portfolio Summary
              </h3>
            </div>

            <dl className="space-y-2.5">
              {[
                {
                  label: "Properties",
                  value: totalProperties,
                  href: "/dashboard/properties",
                },
                {
                  label: "Total Units",
                  value: totalUnits,
                  href: "/dashboard/units",
                },
                {
                  label: "Active Tenants",
                  value: activeTenants,
                  href: "/dashboard/tenants",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <Link
                    href={item.href}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {item.value}
                  </Link>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500">Occupied</dt>
                <dd className="text-sm font-semibold text-blue-600">
                  {occupiedUnits} / {totalUnits}
                </dd>
              </div>
            </dl>

            {/* Occupancy progress bar */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
                <span>Occupancy</span>
                <span className="font-medium text-gray-600">
                  {occupancyRate}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${occupancyPct}%` }}
                />
              </div>
            </div>

            {/* Shortcuts */}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {[
                { label: "Properties", href: "/dashboard/properties" },
                { label: "Units", href: "/dashboard/units" },
                { label: "Expenses", href: "/dashboard/expenses" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-md bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
