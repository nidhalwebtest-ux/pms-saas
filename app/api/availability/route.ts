/**
 * GET /api/availability?propertyId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns per-unit / per-day cell data for the availability calendar.
 * Max range: 90 days.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays, format } from "date-fns";

async function getOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

// ── Color palette (hex) ────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "#185FA5",
  CHECKED_IN: "#EF4444",
  PENDING:    "#EAB308",
};
const VACANT_COLOR  = "#22C55E";
const BLOCKED_COLOR = "#6B7280";

type ResInfo = {
  id: string;
  reservationNumber: string | null;
  guestName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  rateAmount: number;
};

export async function GET(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId  = searchParams.get("propertyId");
  const startStr    = searchParams.get("startDate");
  const endStr      = searchParams.get("endDate");
  const unitTypes   = searchParams.get("unitTypes");
  const floorParam  = searchParams.get("floor");

  if (!propertyId || !startStr || !endStr)
    return NextResponse.json(
      { error: "propertyId, startDate, endDate are required" },
      { status: 400 },
    );

  const startDate = new Date(startStr);
  const endDate   = new Date(endStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate)
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const totalDays = differenceInDays(endDate, startDate);
  if (totalDays > 90)
    return NextResponse.json(
      { error: "Date range too large (max 90 days)" },
      { status: 400 },
    );

  // Verify property
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, name: true },
  });
  if (!property || property.organizationId !== orgId)
    return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Build unit where clause
  const unitWhere: Record<string, unknown> = { propertyId };
  if (unitTypes) {
    const types = unitTypes.split(",").filter(Boolean);
    if (types.length > 0) unitWhere.unitType = { in: types };
  }
  if (floorParam && floorParam !== "all") {
    const f = parseInt(floorParam, 10);
    if (!isNaN(f)) unitWhere.floor = f;
  }

  const units = await prisma.unit.findMany({
    where: unitWhere,
    include: {
      prices: {
        where: { isActive: true, priceType: "DEFAULT" },
        orderBy: { priority: "desc" },
        take: 1,
      },
    },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  // ── Fetch overlapping reservations ─────────────────────────────────────────
  const [resOld, resNew] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        unit: { propertyId },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
        unitId: { not: null },
      },
      select: {
        id: true, reservationNumber: true, status: true,
        startDate: true, endDate: true, totalNights: true,
        grandTotal: true, rateType: true,
        unitId: true,
        tenant: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.reservationUnit.findMany({
      where: {
        unit: { propertyId },
        reservation: {
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startDate: { lt: endDate },
          endDate:   { gt: startDate },
        },
      },
      select: {
        unitId: true,
        rateAmount: true,
        reservation: {
          select: {
            id: true, reservationNumber: true, status: true,
            startDate: true, endDate: true,
            tenant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  // Build per-unit map
  const unitResMap = new Map<string, ResInfo[]>();
  const seenResUnit = new Set<string>(); // "resId:unitId"

  for (const r of resOld) {
    if (!r.unitId) continue;
    const key = `${r.id}:${r.unitId}`;
    if (seenResUnit.has(key)) continue;
    seenResUnit.add(key);
    if (!unitResMap.has(r.unitId)) unitResMap.set(r.unitId, []);
    const nightlyRate =
      r.totalNights > 0 ? Number(r.grandTotal) / r.totalNights : Number(r.grandTotal);
    unitResMap.get(r.unitId)!.push({
      id: r.id,
      reservationNumber: r.reservationNumber,
      guestName: `${r.tenant.firstName} ${r.tenant.lastName}`,
      status: r.status,
      startDate: r.startDate,
      endDate: r.endDate,
      rateAmount: nightlyRate,
    });
  }

  for (const ru of resNew) {
    const key = `${ru.reservation.id}:${ru.unitId}`;
    if (seenResUnit.has(key)) continue;
    seenResUnit.add(key);
    if (!unitResMap.has(ru.unitId)) unitResMap.set(ru.unitId, []);
    unitResMap.get(ru.unitId)!.push({
      id: ru.reservation.id,
      reservationNumber: ru.reservation.reservationNumber,
      guestName: `${ru.reservation.tenant.firstName} ${ru.reservation.tenant.lastName}`,
      status: ru.reservation.status,
      startDate: ru.reservation.startDate,
      endDate: ru.reservation.endDate,
      rateAmount: Number(ru.rateAmount),
    });
  }

  // ── Build date list ────────────────────────────────────────────────────────
  const dates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    dates.push(format(addDays(startDate, i), "yyyy-MM-dd"));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  let statOccupied = 0;
  let statReserved = 0;
  let statVacant   = 0;
  let statBlocked  = 0;
  let potentialRevenue = 0;

  // ── Per-unit computation ───────────────────────────────────────────────────
  const unitResults = units.map((unit) => {
    const reservations = unitResMap.get(unit.id) ?? [];
    const defaultDailyRate =
      unit.prices[0]
        ? Number(unit.prices[0].dailyRate)
        : Number(unit.basePrice);
    const isMaintenance = unit.status === "MAINTENANCE";

    // Sort for gap detection
    const sorted = [...reservations].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );

    const days = dates.map((dateStr) => {
      const d = new Date(dateStr);
      const dNext = addDays(d, 1);

      // LEFT half = night from d-1 to d
      //   occupied by res if: res.startDate < d AND res.endDate >= d
      const leftRes = reservations.find(
        (r) => r.startDate < d && r.endDate >= d,
      );

      // RIGHT half = night from d to d+1
      //   occupied by res if: res.startDate <= d AND res.endDate > d
      const rightRes = reservations.find(
        (r) => r.startDate <= d && r.endDate > d,
      );

      const leftColor = isMaintenance
        ? BLOCKED_COLOR
        : leftRes
          ? (STATUS_COLOR[leftRes.status] ?? BLOCKED_COLOR)
          : VACANT_COLOR;

      const rightColor = isMaintenance
        ? BLOCKED_COLOR
        : rightRes
          ? (STATUS_COLOR[rightRes.status] ?? BLOCKED_COLOR)
          : VACANT_COLOR;

      // Stats: count based on the NIGHT (right half)
      if (isMaintenance) {
        statBlocked++;
      } else if (!rightRes) {
        statVacant++;
        potentialRevenue += defaultDailyRate;
      } else if (rightRes.status === "CHECKED_IN") {
        statOccupied++;
      } else {
        statReserved++;
      }

      // Classify the cell
      const isTurnaround = !!(leftRes && rightRes && leftRes.id !== rightRes.id);
      const isStaying    = !!(leftRes && rightRes && leftRes.id === rightRes.id);
      const isArriving   = !!(rightRes && !leftRes);
      const isDeparting  = !!(leftRes && !rightRes);

      const serializeRes = (r: ResInfo) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        guestName: r.guestName,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        status: r.status,
        rateAmount: r.rateAmount,
      });

      return {
        date: dateStr,
        leftColor,
        rightColor,
        solid: leftColor === rightColor,
        isGap: false, // filled in second pass below
        arriving:   isArriving  ? serializeRes(rightRes!) : null,
        departing:  isDeparting ? serializeRes(leftRes!)  : null,
        staying:    isStaying   ? serializeRes(leftRes!)  : null,
        turnaround: isTurnaround
          ? { departing: serializeRes(leftRes!), arriving: serializeRes(rightRes!) }
          : null,
      };
    });

    // Gap detection pass: mark vacant nights between two reservations ≤ 7 days apart
    days.forEach((day) => {
      if (!day.solid || day.rightColor !== VACANT_COLOR) return; // not fully vacant
      const d = new Date(day.date);

      const lastCheckout = sorted
        .filter((r) => r.endDate <= d)
        .at(-1);
      const nextCheckin = sorted
        .find((r) => r.startDate > d);

      const daysSince = lastCheckout
        ? differenceInDays(d, lastCheckout.endDate)
        : 999;
      const daysUntil = nextCheckin
        ? differenceInDays(nextCheckin.startDate, d)
        : 999;

      if (daysSince <= 7 && daysUntil <= 7) {
        day.isGap = true;
      }
    });

    return {
      id: unit.id,
      name: unit.name,
      floor: unit.floor,
      unitType: unit.unitType,
      status: unit.status,
      defaultDailyRate,
      days,
    };
  });

  const totalUnitNights = units.length * totalDays;

  return NextResponse.json({
    units: unitResults,
    dates,
    stats: {
      totalUnitNights,
      occupied:         statOccupied,
      reserved:         statReserved,
      vacant:           statVacant,
      blocked:          statBlocked,
      potentialRevenue: potentialRevenue.toFixed(3),
    },
    propertyName: property.name,
    startDate: startStr,
    endDate: endStr,
  });
}
