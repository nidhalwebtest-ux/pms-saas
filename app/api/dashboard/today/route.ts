import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { tenantDisplayName } from "@/lib/tenant-display";

async function getOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

function propResFilter(propertyId: string) {
  if (!propertyId) return {};
  return {
    OR: [
      { unit: { propertyId } },
      { reservationUnits: { some: { unit: { propertyId } } } },
    ],
  };
}

const resSelect = {
  id: true,
  reservationNumber: true,
  status: true,
  startDate: true,
  endDate: true,
  totalNights: true,
  grandTotal: true,
  amountPaid: true,
  tenant: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      classification: true,
      tenantType: true,
      corporateName: true,
    },
  },
  unit: {
    select: {
      id: true,
      name: true,
      property: { select: { id: true, name: true } },
    },
  },
  reservationUnits: {
    where: { isMovedOut: { not: true } },
    select: { unit: { select: { id: true, name: true } } },
  },
  // Real outstanding balance comes from the invoices, not the stale
  // reservation.amountPaid (which invoice payments never update). Exclude
  // cancelled/void and DRAFT (un-issued, no revenue posted).
  invoices: {
    where: { status: { notIn: ["CANCELLED", "VOID", "DRAFT"] } },
    select: { balanceDue: true },
  },
} satisfies Prisma.ReservationSelect;

function serializeRes(r: {
  id: string;
  reservationNumber: string | null;
  status: string;
  startDate: Date;
  endDate: Date;
  totalNights: number;
  grandTotal: unknown;
  amountPaid: unknown;
  tenant: { id: string; firstName: string; lastName: string; phone: string | null; classification: string; tenantType: string | null; corporateName: string | null };
  unit: { id: string; name: string; property: { id: string; name: string } } | null;
  reservationUnits: { unit: { id: string; name: string } }[];
  invoices: { balanceDue: unknown }[];
}) {
  const unitNames =
    r.unit ? [r.unit.name] : r.reservationUnits.map((ru) => ru.unit.name);
  const propertyName = r.unit?.property?.name ?? "—";
  const gt = Number(r.grandTotal);
  // Outstanding = sum of issued, non-cancelled invoice balances.
  const balance = r.invoices.reduce((s, inv) => s + Number(inv.balanceDue), 0);
  const ap = gt - balance;
  return {
    id: r.id,
    reservationNumber: r.reservationNumber,
    status: r.status,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    totalNights: r.totalNights,
    grandTotal: gt,
    amountPaid: ap,
    balance,
    tenant: {
      id: r.tenant.id,
      name: tenantDisplayName(r.tenant), // company name for corporate tenants (QA #25)
      phone: r.tenant.phone ?? null,
      classification: r.tenant.classification,
    },
    unitNames,
    propertyName,
  };
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId =
    new URL(req.url).searchParams.get("propertyId") ?? "";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const last24h    = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const baseFilter = {
    tenant: { organizationId: orgId },
    ...propResFilter(propertyId),
  };

  const [
    arrivals,
    overdueArrivals,
    departures,
    overstays,
    inHouseCount,
    paymentsRaw,
    expensesTodayAgg,
    recentActivities,
  ] = await Promise.all([
    // Arriving today: CONFIRMED or PENDING, startDate = today
    prisma.reservation.findMany({
      where: {
        ...baseFilter,
        startDate: { gte: todayStart, lt: todayEnd },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: resSelect,
      orderBy: { startDate: "asc" },
    }),

    // Overdue arrivals: expected before today but not yet checked in
    prisma.reservation.findMany({
      where: {
        ...baseFilter,
        startDate: { lt: todayStart },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: resSelect,
      orderBy: { startDate: "asc" },
    }),

    // Departures today: CHECKED_IN, endDate = today
    prisma.reservation.findMany({
      where: {
        ...baseFilter,
        endDate: { gte: todayStart, lt: todayEnd },
        status: "CHECKED_IN",
      },
      select: resSelect,
      orderBy: { endDate: "asc" },
    }),

    // Overstays: CHECKED_IN, endDate < today (should have left)
    prisma.reservation.findMany({
      where: {
        ...baseFilter,
        endDate: { lt: todayStart },
        status: "CHECKED_IN",
      },
      select: resSelect,
      orderBy: { endDate: "asc" },
    }),

    // Total in house
    prisma.reservation.count({
      where: { ...baseFilter, status: "CHECKED_IN" },
    }),

    // Today's payments
    prisma.payment.findMany({
      where: {
        reservation: { tenant: { organizationId: orgId } },
        date: { gte: todayStart, lt: todayEnd },
      },
      select: { method: true, amount: true },
    }),

    // Today's expenses (submitted today, excluding rejected)
    prisma.expense.aggregate({
      where: {
        organizationId: orgId,
        ...(propertyId ? { propertyId } : {}),
        status: { not: "REJECTED" },
        submittedAt: { gte: todayStart, lt: todayEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // Recent activity (last 24 h)
    prisma.reservationActivity.findMany({
      where: { organizationId: orgId, createdAt: { gte: last24h } },
      include: {
        reservation: {
          select: {
            id: true,
            reservationNumber: true,
            tenant: { select: { firstName: true, lastName: true } },
            unit: { select: { name: true } },
          },
        },
        performedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  // Aggregate payments by method
  const paymentsByMethod: Record<string, number> = {};
  let totalPayments = 0;
  for (const p of paymentsRaw) {
    const amt = Number(p.amount);
    paymentsByMethod[p.method] = (paymentsByMethod[p.method] ?? 0) + amt;
    totalPayments += amt;
  }

  return NextResponse.json({
    arrivals: arrivals.map(serializeRes),
    overdueArrivals: overdueArrivals.map(serializeRes),
    departures: departures.map(serializeRes),
    overstays: overstays.map(serializeRes),
    inHouseCount,
    paymentsToday: { ...paymentsByMethod, total: totalPayments },
    expensesToday: {
      total: Number(expensesTodayAgg._sum?.amount ?? 0),
      count: expensesTodayAgg._count?._all ?? 0,
    },
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
      reservationId: a.reservationId,
      reservationNumber: a.reservation?.reservationNumber ?? null,
      guestName: a.reservation?.tenant
        ? `${a.reservation.tenant.firstName} ${a.reservation.tenant.lastName}`
        : null,
      unitName: a.reservation?.unit?.name ?? null,
      performedBy: a.performedBy
        ? `${a.performedBy.firstName} ${a.performedBy.lastName}`
        : null,
    })),
  });
}
