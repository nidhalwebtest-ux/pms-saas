import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId =
    new URL(req.url).searchParams.get("propertyId") ?? "";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const unitWhere = {
    property: { organizationId: orgId },
    ...(propertyId ? { propertyId } : {}),
  };
  const resBase = {
    tenant: { organizationId: orgId },
    ...propResFilter(propertyId),
  };

  const invoicePropFilter = propertyId ? { propertyId } : {};

  const [units, properties, checkedInRes, upcomingRes, balanceRes, draftInvoices] =
    await Promise.all([
      // All units for count
      prisma.unit.findMany({
        where: unitWhere,
        select: { id: true, status: true, propertyId: true },
      }),

      // Properties for building breakdown
      prisma.property.findMany({
        where: {
          organizationId: orgId,
          isArchived: false,
          ...(propertyId ? { id: propertyId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),

      // CHECKED_IN reservations (for occupied unit IDs + current guest list)
      prisma.reservation.findMany({
        where: { ...resBase, status: "CHECKED_IN" },
        select: {
          id: true,
          reservationNumber: true,
          startDate: true,
          endDate: true,
          totalNights: true,
          grandTotal: true,
          amountPaid: true,
          unitId: true,
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              classification: true,
            },
          },
          unit: {
            select: {
              id: true,
              name: true,
              property: { select: { name: true } },
            },
          },
          reservationUnits: {
            where: { isMovedOut: { not: true } },
            select: { unitId: true, unit: { select: { id: true, name: true } } },
          },
          invoices: {
            where: { status: { notIn: ["CANCELLED", "VOID", "DRAFT"] } },
            select: { balanceDue: true },
          },
        },
      }),

      // Upcoming CONFIRMED reservations (for reserved unit IDs)
      prisma.reservation.findMany({
        where: {
          ...resBase,
          status: { in: ["CONFIRMED", "PENDING"] },
          startDate: { gte: todayStart },
        },
        select: {
          unitId: true,
          reservationUnits: {
            where: { isMovedOut: { not: true } },
            select: { unitId: true },
          },
        },
      }),

      // All active reservations with a balance (for outstanding list)
      prisma.reservation.findMany({
        where: {
          ...resBase,
          status: { in: ["CHECKED_IN", "CONFIRMED", "PENDING"] },
        },
        select: {
          id: true,
          reservationNumber: true,
          status: true,
          endDate: true,
          grandTotal: true,
          amountPaid: true,
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          unit: { select: { name: true } },
          invoices: {
            where: { status: { notIn: ["CANCELLED", "VOID", "DRAFT"] } },
            select: { balanceDue: true },
          },
        },
      }),

      // Invoices waiting to be issued (DRAFT) — sorted by upcoming periodStart
      prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          status: "DRAFT",
          ...invoicePropFilter,
        },
        select: {
          id: true,
          invoiceNumber: true,
          periodStart: true,
          periodEnd: true,
          dueDate: true,
          totalAmount: true,
          monthNumber: true,
          tenant: { select: { id: true, firstName: true, lastName: true } },
          reservation: { select: { id: true, reservationNumber: true } },
          property: { select: { name: true } },
        },
        orderBy: { periodStart: "asc" },
      }),
    ]);

  // ── Derive occupied & reserved unit ID sets ───────────────────────────────
  const occupiedUnitIds = new Set<string>();
  const reservedUnitIds = new Set<string>();

  for (const r of checkedInRes) {
    if (r.unitId) occupiedUnitIds.add(r.unitId);
    for (const ru of r.reservationUnits) occupiedUnitIds.add(ru.unitId);
  }
  for (const r of upcomingRes) {
    if (r.unitId) reservedUnitIds.add(r.unitId);
    for (const ru of r.reservationUnits) reservedUnitIds.add(ru.unitId);
  }

  // ── Unit counts + per-property breakdown ──────────────────────────────────
  type PropBucket = {
    total: number; occupied: number; reserved: number;
    vacant: number; maintenance: number;
  };
  let occupied = 0, reserved = 0, vacant = 0, maintenance = 0;
  const byProp: Record<string, PropBucket> = {};

  for (const unit of units) {
    if (!byProp[unit.propertyId]) {
      byProp[unit.propertyId] = {
        total: 0, occupied: 0, reserved: 0, vacant: 0, maintenance: 0,
      };
    }
    const b = byProp[unit.propertyId];
    b.total++;

    if (unit.status === "MAINTENANCE") {
      maintenance++;
      b.maintenance++;
    } else if (occupiedUnitIds.has(unit.id)) {
      occupied++;
      b.occupied++;
    } else if (reservedUnitIds.has(unit.id)) {
      reserved++;
      b.reserved++;
    } else {
      vacant++;
      b.vacant++;
    }
  }

  const buildingOccupancy = properties.map((prop) => {
    const b = byProp[prop.id] ?? {
      total: 0, occupied: 0, reserved: 0, vacant: 0, maintenance: 0,
    };
    return {
      id: prop.id,
      name: prop.name,
      ...b,
      occupancyPct:
        b.total > 0
          ? Math.round((b.occupied / b.total) * 1000) / 10
          : 0,
    };
  });

  // ── Current guests ────────────────────────────────────────────────────────
  const currentGuests = checkedInRes.map((r) => {
    const unitNames = r.unit
      ? [r.unit.name]
      : r.reservationUnits.map((ru) => ru.unit.name);
    const propertyName = r.unit?.property?.name ?? "—";
    const nightsRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(r.endDate).getTime() - todayStart.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const gt = Number(r.grandTotal);
    // Outstanding = sum of issued (non-cancelled, non-draft) invoice balances.
    const balance = r.invoices.reduce((s, inv) => s + Number(inv.balanceDue), 0);
    const ap = gt - balance;
    return {
      id: r.id,
      reservationNumber: r.reservationNumber,
      tenant: {
        id: r.tenant.id,
        name: `${r.tenant.firstName} ${r.tenant.lastName}`,
        phone: r.tenant.phone ?? null,
        classification: r.tenant.classification,
      },
      unitNames,
      propertyName,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      totalNights: r.totalNights,
      nightsRemaining,
      grandTotal: gt,
      amountPaid: ap,
      balance,
    };
  });

  // ── Outstanding balances ──────────────────────────────────────────────────
  const balanceOf = (r: { invoices: { balanceDue: unknown }[] }) =>
    r.invoices.reduce((s, inv) => s + Number(inv.balanceDue), 0);
  const outstandingBalances = balanceRes
    .filter((r) => balanceOf(r) > 0.001)
    .map((r) => {
      const gt = Number(r.grandTotal);
      const balance = balanceOf(r);
      const ap = gt - balance;
      return {
        id: r.id,
        reservationNumber: r.reservationNumber,
        status: r.status,
        tenant: {
          id: r.tenant.id,
          name: `${r.tenant.firstName} ${r.tenant.lastName}`,
          phone: r.tenant.phone ?? null,
        },
        unitName: r.unit?.name ?? "Multi-unit",
        endDate: r.endDate.toISOString(),
        grandTotal: gt,
        amountPaid: ap,
        balance,
        daysPastCheckout:
          r.endDate < todayStart
            ? Math.floor(
                (todayStart.getTime() - r.endDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0,
      };
    })
    .sort(
      (a, b) =>
        b.daysPastCheckout - a.daysPastCheckout || b.balance - a.balance,
    );

  // ── Invoices to be issued (DRAFT) ─────────────────────────────────────────
  const invoicesToBeIssued = draftInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    tenant: {
      id: inv.tenant.id,
      name: `${inv.tenant.firstName} ${inv.tenant.lastName}`,
    },
    reservation: inv.reservation
      ? { id: inv.reservation.id, number: inv.reservation.reservationNumber }
      : null,
    propertyName: inv.property?.name ?? null,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    totalAmount: Number(inv.totalAmount),
    monthNumber: inv.monthNumber,
  }));

  return NextResponse.json({
    unitCounts: { total: units.length, occupied, reserved, vacant, maintenance },
    buildingOccupancy,
    currentGuests,
    outstandingBalances,
    invoicesToBeIssued,
  });
}
