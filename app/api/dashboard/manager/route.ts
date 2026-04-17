import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
} from "date-fns";

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

function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId =
    new URL(req.url).searchParams.get("propertyId") ?? "";

  const now = new Date();
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart  = startOfMonth(now);
  const prevStart   = startOfMonth(addMonths(now, -1));
  // Same number of days elapsed last month
  const daysElapsed = now.getDate();
  const prevSameDay = new Date(
    prevStart.getFullYear(),
    prevStart.getMonth(),
    daysElapsed + 1,
  );
  const thirtyAgo   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = startOfMonth(addMonths(now, -5));

  const resBase   = { tenant: { organizationId: orgId }, ...propResFilter(propertyId) };
  const payBase   = { reservation: { tenant: { organizationId: orgId } } };
  const expBase   = {
    organizationId: orgId,
    status: { not: "REJECTED" as const },
    ...(propertyId ? { propertyId } : {}),
  };

  // ── Phase-1 parallel queries ───────────────────────────────────────────────
  const [
    revCurrent,
    revPrev,
    expCurrent,
    expPrev,
    totalUnits,
    checkedInCount,
    outstandingRes,
    payments30d,
    expensesMonth,
    agingRaw,
    perfActivities,
    perfUsers,
    properties,
    payments6m,
    overstayCount,
    refundCount,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...payBase, date: { gte: monthStart, lt: todayStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...payBase, date: { gte: prevStart, lt: prevSameDay } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { ...expBase, submittedAt: { gte: monthStart, lt: todayStart } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { ...expBase, submittedAt: { gte: prevStart, lt: prevSameDay } },
      _sum: { amount: true },
    }),
    prisma.unit.count({
      where: {
        property: { organizationId: orgId },
        ...(propertyId ? { propertyId } : {}),
      },
    }),
    prisma.reservation.count({
      where: { ...resBase, status: "CHECKED_IN" },
    }),
    prisma.reservation.findMany({
      where: {
        ...resBase,
        status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
      },
      select: { grandTotal: true, amountPaid: true },
    }),
    // All payments last 30 days (for daily trend chart)
    prisma.payment.findMany({
      where: { ...payBase, date: { gte: thirtyAgo } },
      select: { date: true, amount: true },
    }),
    // All expenses this month (for category breakdown)
    prisma.expense.findMany({
      where: { ...expBase, submittedAt: { gte: monthStart } },
      select: { amount: true, category: { select: { name: true } } },
    }),
    // All reservations with potential balance (for aging)
    prisma.reservation.findMany({
      where: {
        ...resBase,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: {
        grandTotal: true,
        amountPaid: true,
        endDate: true,
        status: true,
      },
    }),
    // Receptionist performance: group by user + action this month
    prisma.reservationActivity.groupBy({
      by: ["performedById", "action"],
      where: {
        organizationId: orgId,
        createdAt: { gte: monthStart },
        performedById: { not: null },
      },
      _count: { id: true },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, role: true },
    }),
    prisma.property.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        ...(propertyId ? { id: propertyId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Payments for 6-month revenue trend
    prisma.payment.findMany({
      where: { ...payBase, date: { gte: sixMonthsAgo } },
      select: { date: true, amount: true },
    }),
    prisma.reservation.count({
      where: { ...resBase, status: "CHECKED_IN", endDate: { lt: todayStart } },
    }),
    prisma.reservation.count({
      where: { ...resBase, status: "CANCELLED", refundPending: true },
    }),
  ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const revMTD  = Number(revCurrent._sum.amount ?? 0);
  const revPrevN = Number(revPrev._sum.amount ?? 0);
  const expMTD  = Number(expCurrent._sum?.amount ?? 0);
  const expPrevN = Number(expPrev._sum?.amount ?? 0);
  const noi     = revMTD - expMTD;
  const noiPrev = revPrevN - expPrevN;
  const occupancyRate =
    totalUnits > 0
      ? Math.round((checkedInCount / totalUnits) * 1000) / 10
      : 0;
  const outstanding = outstandingRes.reduce((s, r) => {
    const b = Number(r.grandTotal) - Number(r.amountPaid);
    return s + (b > 0.001 ? b : 0);
  }, 0);
  const outstandingCount = outstandingRes.filter(
    (r) => Number(r.grandTotal) - Number(r.amountPaid) > 0.001,
  ).length;

  // ── Revenue trend (daily, 30 days) ────────────────────────────────────────
  const revByDay = new Map<string, number>();
  for (const p of payments30d) {
    const key = format(new Date(p.date), "yyyy-MM-dd");
    revByDay.set(key, (revByDay.get(key) ?? 0) + Number(p.amount));
  }
  const revenueTrend = eachDayOfInterval({
    start: thirtyAgo,
    end: todayStart,
  }).map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, revenue: revByDay.get(key) ?? 0 };
  });

  // ── Expense breakdown by category ─────────────────────────────────────────
  const expByCat = new Map<string, number>();
  let totalExpMonth = 0;
  for (const e of expensesMonth) {
    const amt = Number(e.amount);
    const catName = e.category?.name ?? "Uncategorized";
    expByCat.set(catName, (expByCat.get(catName) ?? 0) + amt);
    totalExpMonth += amt;
  }
  const expenseBreakdown = Array.from(expByCat.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      pct:
        totalExpMonth > 0
          ? Math.round((amount / totalExpMonth) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Aging receivables ─────────────────────────────────────────────────────
  const aging = {
    current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0,
  };
  const agingCounts = {
    current: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0,
  };
  for (const r of agingRaw) {
    const balance = Number(r.grandTotal) - Number(r.amountPaid);
    if (balance <= 0.001) continue;
    const past =
      r.endDate < todayStart
        ? Math.floor(
            (todayStart.getTime() - new Date(r.endDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : -1;
    if (past < 0 || r.status === "CHECKED_IN") {
      aging.current += balance;
      agingCounts.current++;
    } else if (past <= 30) {
      aging.d1to30 += balance;
      agingCounts.d1to30++;
    } else if (past <= 60) {
      aging.d31to60 += balance;
      agingCounts.d31to60++;
    } else if (past <= 90) {
      aging.d61to90 += balance;
      agingCounts.d61to90++;
    } else {
      aging.d90plus += balance;
      agingCounts.d90plus++;
    }
  }

  // ── Receptionist performance ──────────────────────────────────────────────
  type PerfRow = {
    checkins: number; checkouts: number; created: number; payments: number;
  };
  const perfMap = new Map<string, PerfRow>();
  for (const act of perfActivities) {
    if (!act.performedById) continue;
    if (!perfMap.has(act.performedById)) {
      perfMap.set(act.performedById, {
        checkins: 0, checkouts: 0, created: 0, payments: 0,
      });
    }
    const row = perfMap.get(act.performedById)!;
    const cnt = act._count.id;
    if (act.action === "CHECKED_IN")         row.checkins  += cnt;
    else if (act.action === "CHECKED_OUT")   row.checkouts += cnt;
    else if (act.action === "CREATED")       row.created   += cnt;
    else if (act.action === "PAYMENT_RECORDED") row.payments += cnt;
  }
  const receptionistPerformance = perfUsers
    .filter((u) => perfMap.has(u.id))
    .map((u) => {
      const p = perfMap.get(u.id)!;
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role as string,
        ...p,
        total: p.checkins + p.checkouts + p.created + p.payments,
      };
    })
    .sort((a, b) => b.total - a.total);

  // ── 6-month revenue trend ─────────────────────────────────────────────────
  const revByMonth = new Map<string, number>();
  for (const p of payments6m) {
    const key = format(new Date(p.date), "yyyy-MM");
    revByMonth.set(key, (revByMonth.get(key) ?? 0) + Number(p.amount));
  }
  const occupancyTrend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(now, i - 5);
    const key = format(m, "yyyy-MM");
    return {
      month: format(m, "MMM yy"),
      monthKey: key,
      revenue: revByMonth.get(key) ?? 0,
    };
  });

  // ── Building comparison (phase-2 queries) ─────────────────────────────────
  const propRevMap  = new Map<string, number>();
  const propExpMap  = new Map<string, number>();
  const propUnitMap = new Map<string, number>();
  const propOccMap  = new Map<string, number>();

  const [propPayments, propExpenses, allUnitsForComp, occupiedResForComp] =
    await Promise.all([
      prisma.payment.findMany({
        where: { ...payBase, date: { gte: monthStart } },
        select: {
          amount: true,
          reservation: {
            select: {
              unit: { select: { propertyId: true } },
              reservationUnits: {
                take: 1,
                select: { unit: { select: { propertyId: true } } },
              },
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: { ...expBase, submittedAt: { gte: monthStart } },
        select: { amount: true, propertyId: true },
      }),
      prisma.unit.findMany({
        where: {
          property: {
            organizationId: orgId,
            isArchived: false,
            ...(propertyId ? { id: propertyId } : {}),
          },
        },
        select: { id: true, propertyId: true },
      }),
      prisma.reservation.findMany({
        where: { ...resBase, status: "CHECKED_IN" },
        select: {
          unitId: true,
          unit: { select: { propertyId: true } },
          reservationUnits: {
            where: { isMovedOut: { not: true } },
            select: { unit: { select: { propertyId: true } } },
          },
        },
      }),
    ]);

  for (const unit of allUnitsForComp) {
    propUnitMap.set(
      unit.propertyId,
      (propUnitMap.get(unit.propertyId) ?? 0) + 1,
    );
  }
  for (const r of occupiedResForComp) {
    const pid =
      r.unit?.propertyId ??
      r.reservationUnits?.[0]?.unit?.propertyId;
    if (pid) propOccMap.set(pid, (propOccMap.get(pid) ?? 0) + 1);
  }
  for (const p of propPayments) {
    const pid =
      p.reservation?.unit?.propertyId ??
      p.reservation?.reservationUnits?.[0]?.unit?.propertyId;
    if (pid) {
      propRevMap.set(pid, (propRevMap.get(pid) ?? 0) + Number(p.amount));
    }
  }
  for (const e of propExpenses) {
    propExpMap.set(
      e.propertyId,
      (propExpMap.get(e.propertyId) ?? 0) + Number(e.amount),
    );
  }

  const buildingComparison = properties.map((prop) => {
    const totalU = propUnitMap.get(prop.id) ?? 0;
    const occ    = propOccMap.get(prop.id) ?? 0;
    const rev    = propRevMap.get(prop.id) ?? 0;
    const exp    = propExpMap.get(prop.id) ?? 0;
    return {
      id: prop.id,
      name: prop.name,
      totalUnits: totalU,
      occupied: occ,
      occupancyPct: totalU > 0 ? Math.round((occ / totalU) * 1000) / 10 : 0,
      revenue: rev,
      expenses: exp,
      noi: rev - exp,
    };
  });

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: {
    type: string;
    severity: "red" | "amber" | "blue";
    message: string;
    link?: string;
  }[] = [];

  if (overstayCount > 0) {
    alerts.push({
      type: "overstay",
      severity: "red",
      message: `${overstayCount} overstay guest${overstayCount > 1 ? "s" : ""} — immediate action required`,
      link: "/dashboard/reservations",
    });
  }
  if (refundCount > 0) {
    alerts.push({
      type: "refund",
      severity: "amber",
      message: `${refundCount} cancelled reservation${refundCount > 1 ? "s" : ""} with refund pending`,
      link: "/dashboard/reservations",
    });
  }
  if (aging.d90plus > 0.001) {
    alerts.push({
      type: "aging",
      severity: "red",
      message: `${agingCounts.d90plus} tenant${agingCounts.d90plus > 1 ? "s" : ""} overdue 90+ days — ${aging.d90plus.toFixed(3)} OMR at risk`,
      link: "/dashboard/payments",
    });
  }
  if (occupancyRate < 50 && totalUnits > 0) {
    alerts.push({
      type: "occupancy",
      severity: "amber",
      message: `Occupancy at ${occupancyRate}% — consider promotional rates or targeted outreach`,
    });
  }
  if (aging.d31to60 + aging.d61to90 > 0.001) {
    const cnt = agingCounts.d31to60 + agingCounts.d61to90;
    const amt = aging.d31to60 + aging.d61to90;
    alerts.push({
      type: "overdue",
      severity: "amber",
      message: `${cnt} tenant${cnt > 1 ? "s" : ""} with balance overdue 31–90 days (${amt.toFixed(3)} OMR)`,
      link: "/dashboard/payments",
    });
  }

  return NextResponse.json({
    kpis: {
      revenueMTD:       revMTD,
      revenueTrend:     trendPct(revMTD, revPrevN),
      expensesMTD:      expMTD,
      expensesTrend:    trendPct(expMTD, expPrevN),
      noi,
      noiTrend:         trendPct(noi, noiPrev),
      occupancyRate,
      outstanding,
      outstandingCount,
    },
    revenueTrend,
    expenseBreakdown,
    aging: { buckets: aging, counts: agingCounts },
    receptionistPerformance,
    buildingComparison,
    occupancyTrend,
    alerts,
  });
}
