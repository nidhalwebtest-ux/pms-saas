import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/current-user";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { Prisma } from "@prisma/client";
import {
  getDisplayStatus,
  type StoredStatus,
} from "@/lib/reservation-status";
import { createReservationCore, MonthlyBlockedError, DoubleBookingError } from "@/lib/reservation-engine-core";

// ── GET /api/reservations ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp         = new URL(req.url).searchParams;
  const search     = sp.get("search")     ?? "";
  const propertyId = sp.get("propertyId") ?? "";
  const dateFrom   = sp.get("dateFrom")   ?? "";
  const dateTo     = sp.get("dateTo")     ?? "";
  const rateType   = sp.get("rateType")   ?? "";
  const source     = sp.get("source")     ?? "";

  // Building scope: limit to the user's accessible buildings (null = unrestricted).
  const propIds = await getEffectivePropertyIds(propertyId);

  const where: Prisma.ReservationWhereInput = {
    tenant: { organizationId: actor.organizationId! },
    ...(search ? {
      OR: [
        { reservationNumber: { contains: search, mode: "insensitive" } },
        { tenant: { firstName:  { contains: search, mode: "insensitive" } } },
        { tenant: { lastName:   { contains: search, mode: "insensitive" } } },
        { tenant: { phone:      { contains: search } } },
        { unit:   { name:       { contains: search, mode: "insensitive" } } },
        { reservationUnits: { some: { unit: { name: { contains: search, mode: "insensitive" } } } } },
      ],
    } : {}),
    ...(propIds ? {
      AND: [{
        OR: [
          { unit: { propertyId: { in: propIds } } },
          { reservationUnits: { some: { unit: { propertyId: { in: propIds } } } } },
        ],
      }],
    } : {}),
    ...(dateFrom ? { startDate: { gte: new Date(dateFrom) } } : {}),
    ...(dateTo   ? { startDate: { lte: new Date(dateTo)   } } : {}),
    ...(rateType ? { rateType } : {}),
    ...(source   ? { source }   : {}),
  };

  const raws = await prisma.reservation.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, nationality: true, classification: true,
          tenantType: true, corporateName: true,
        },
      },
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
      reservationUnits: {
        include: {
          unit: {
            select: {
              id: true, name: true, floor: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { startDate: "desc" },
    take: 500,
  });

  const today = new Date();
  const reservations = raws.map((r) => {
    const dsInfo = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate, today);

    // Merge legacy unit + multi-unit, dedup by id
    const seen  = new Set<string>();
    const units: { id: string; name: string; floor: number; propertyId: string; propertyName: string }[] = [];
    if (r.unit) {
      seen.add(r.unit.id);
      units.push({ id: r.unit.id, name: r.unit.name, floor: r.unit.floor, propertyId: r.unit.property.id, propertyName: r.unit.property.name });
    }
    for (const ru of r.reservationUnits) {
      if (!seen.has(ru.unit.id)) {
        seen.add(ru.unit.id);
        units.push({ id: ru.unit.id, name: ru.unit.name, floor: ru.unit.floor, propertyId: ru.unit.property.id, propertyName: ru.unit.property.name });
      }
    }

    const grandTotal = Number(r.grandTotal ?? r.totalPrice ?? 0);
    const amountPaid = Number(r.amountPaid ?? 0);

    return {
      id:                      r.id,
      reservationNumber:       r.reservationNumber,
      status:                  r.status,
      displayStatus:           dsInfo.label,
      displayStatusBadgeClass: dsInfo.badgeClass,
      displayStatusRowClass:   dsInfo.rowClass,
      displayStatusPriority:   dsInfo.priority,
      displayStatusUrgent:     dsInfo.urgent,
      displayStatusPulse:      dsInfo.pulse,
      startDate:               r.startDate.toISOString(),
      endDate:                 r.endDate.toISOString(),
      actualCheckIn:           r.actualCheckIn?.toISOString()  ?? null,
      actualCheckOut:          r.actualCheckOut?.toISOString() ?? null,
      totalNights:             r.totalNights,
      rateType:                r.rateType,
      grandTotal:              grandTotal.toFixed(3),
      amountPaid:              amountPaid.toFixed(3),
      balanceDue:              Math.max(0, grandTotal - amountPaid),
      source:                  r.source,
      notes:                   r.notes,
      cancelledReason:         r.cancelledReason,
      tenant:                  r.tenant,
      units,
      createdAt:               r.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ reservations });
}

// ── POST /api/reservations ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const __denied = await forbiddenIfNo("reservations", "CREATE");
  if (__denied) return __denied;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    tenantId,
    unitIds,           // string[]  — at least one unit
    startDate: startStr,
    endDate:   endStr,
    rateType,          // "daily" | "monthly"
    source,
    notes,
    discountAmount: discountRaw = 0,
    // Custom rate overrides: [{unitId, rateAmount}]
    unitOverrides = [] as { unitId: string; rateAmount: number }[],
  } = body;

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0)
    return NextResponse.json({ error: "tenantId and at least one unitId are required." }, { status: 400 });

  if (!startStr || !endStr)
    return NextResponse.json({ error: "startDate and endDate are required." }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });

  if (startDate >= endDate)
    return NextResponse.json({ error: "checkOut must be after checkIn." }, { status: 400 });

  const rt: "daily" | "monthly" = rateType === "monthly" ? "monthly" : "daily";

  // ── Verify tenant belongs to org ──────────────────────────────────────────

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { organizationId: true },
  });
  if (!tenant || tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  // ── Verify units belong to org and compute pricing ─────────────────────────

  const unitRecords = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    include: { property: { select: { organizationId: true } } },
  });

  if (unitRecords.length !== unitIds.length)
    return NextResponse.json({ error: "One or more units not found." }, { status: 404 });

  for (const u of unitRecords) {
    if (u.property.organizationId !== actor.organizationId)
      return NextResponse.json({ error: "Unauthorized access to unit." }, { status: 403 });
  }

  const unitNames: Record<string, string> = {};
  for (const u of unitRecords) unitNames[u.id] = u.name;

  try {
    const created = await createReservationCore(
      {
        tenantId,
        unitIds,
        unitNames,
        startDate,
        endDate,
        rateType: rt,
        source,
        notes,
        discountAmount: discountRaw,
        unitOverrides,
      },
      actor.organizationId!,
      actor.id,
    );

    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof MonthlyBlockedError) {
      const unitName = unitRecords.find((u) => u.id === err.unitId)?.name ?? "this unit";
      return NextResponse.json(
        { error: `Monthly bookings aren't allowed for ${unitName} during ${err.seasonName ?? "this season"}.`, code: "monthly_blocked" },
        { status: 409 },
      );
    }
    if (err instanceof DoubleBookingError) {
      if (err.conflict) {
        return NextResponse.json({ error: "double_booking", conflict: err.conflict }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Unit is no longer available for the selected dates." },
        { status: 409 },
      );
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
