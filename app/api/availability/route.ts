/**
 * GET /api/availability?propertyId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *                       [&unitTypes=a,b][&floor=N]
 *
 * Returns the availability calendar as a SEGMENT model (one bar/cell per
 * booking piece) rather than per-day colored cells — fewer DOM nodes on the
 * client and a direct match for the redesigned grid (arr / body / split / maint).
 * Max range: 90 days. Night-based: a guest occupies NIGHTS [checkIn, checkOut);
 * the checkout day's night is free (vacant) unless another guest arrives → split.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays, format } from "date-fns";

type ResInfo = {
  id: string;
  reservationNumber: string | null;
  guestName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  rateAmount: number;
};

const serializeRes = (r: ResInfo) => ({
  id: r.id,
  reservationNumber: r.reservationNumber,
  guestName: r.guestName,
  status: r.status,
  rateAmount: r.rateAmount,
  startDate: r.startDate.toISOString(),
  endDate: r.endDate.toISOString(),
});

export async function GET(req: Request) {
  const dbUser = await getSessionUser();
  const orgId = dbUser?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");
  const unitTypes = searchParams.get("unitTypes");
  const floorParam = searchParams.get("floor");

  if (!propertyId || !startStr || !endStr)
    return NextResponse.json({ error: "propertyId, startDate, endDate are required" }, { status: 400 });

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate)
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const days = differenceInDays(endDate, startDate);
  if (days > 90)
    return NextResponse.json({ error: "Date range too large (max 90 days)" }, { status: 400 });

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, name: true },
  });
  if (!property || property.organizationId !== orgId)
    return NextResponse.json({ error: "Property not found" }, { status: 404 });

  // Unit filter (unitType / floor) — supported by the calendar's filter bar.
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
      prices: { where: { isActive: true, priceType: "DEFAULT" }, orderBy: { priority: "desc" }, take: 1 },
    },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  // Overlapping reservations — legacy single-unit + multi-unit junction.
  const [resOld, resNew] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        unit: { propertyId },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
        unitId: { not: null },
      },
      select: {
        id: true, reservationNumber: true, status: true,
        startDate: true, endDate: true, totalNights: true, grandTotal: true,
        unitId: true, tenant: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.reservationUnit.findMany({
      where: {
        unit: { propertyId },
        reservation: { status: { notIn: ["CANCELLED", "NO_SHOW"] }, startDate: { lt: endDate }, endDate: { gt: startDate } },
      },
      select: {
        unitId: true, rateAmount: true,
        reservation: {
          select: {
            id: true, reservationNumber: true, status: true, startDate: true, endDate: true,
            tenant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  const unitResMap = new Map<string, ResInfo[]>();
  const seen = new Set<string>();
  for (const r of resOld) {
    if (!r.unitId) continue;
    const key = `${r.id}:${r.unitId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!unitResMap.has(r.unitId)) unitResMap.set(r.unitId, []);
    const nightly = r.totalNights > 0 ? Number(r.grandTotal) / r.totalNights : Number(r.grandTotal);
    unitResMap.get(r.unitId)!.push({
      id: r.id, reservationNumber: r.reservationNumber,
      guestName: `${r.tenant.firstName} ${r.tenant.lastName}`,
      status: r.status, startDate: r.startDate, endDate: r.endDate, rateAmount: nightly,
    });
  }
  for (const ru of resNew) {
    const key = `${ru.reservation.id}:${ru.unitId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!unitResMap.has(ru.unitId)) unitResMap.set(ru.unitId, []);
    unitResMap.get(ru.unitId)!.push({
      id: ru.reservation.id, reservationNumber: ru.reservation.reservationNumber,
      guestName: `${ru.reservation.tenant.firstName} ${ru.reservation.tenant.lastName}`,
      status: ru.reservation.status, startDate: ru.reservation.startDate, endDate: ru.reservation.endDate,
      rateAmount: Number(ru.rateAmount),
    });
  }

  // Visible day list + per-day midnight Date for night-occupancy tests.
  const dates: string[] = [];
  const dayDates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    dates.push(format(d, "yyyy-MM-dd"));
    dayDates.push(d);
  }

  let bookedNights = 0, vacant = 0, maintenance = 0, checkins = 0, potentialRevenue = 0;

  const unitResults = units.map((unit) => {
    const reservations = unitResMap.get(unit.id) ?? [];
    const rate = unit.prices[0] ? Number(unit.prices[0].dailyRate) : Number(unit.basePrice);
    const isMaint = unit.status === "MAINTENANCE";

    type Seg =
      | { kind: "arr"; col: number; res: ReturnType<typeof serializeRes> }
      | { kind: "checkout"; col: number; res: ReturnType<typeof serializeRes> }
      | { kind: "body"; from: number; to: number; flatStart: boolean; flatEnd: boolean; res: ReturnType<typeof serializeRes> }
      | { kind: "split"; col: number; out: ReturnType<typeof serializeRes>; in: ReturnType<typeof serializeRes> }
      | { kind: "maint"; from: number; to: number };

    const segments: Seg[] = [];

    if (isMaint) {
      segments.push({ kind: "maint", from: 0, to: days - 1 });
      maintenance += days;
      return { id: unit.id, name: unit.name, floor: unit.floor, unitType: unit.unitType, defaultDailyRate: rate, occupancyPct: 0, segments };
    }

    // The reservation occupying the NIGHT at each column (start <= day < end).
    const occ: (ResInfo | null)[] = dayDates.map((d) => reservations.find((r) => r.startDate <= d && r.endDate > d) ?? null);

    let booked = 0;
    let col = 0;
    while (col < days) {
      const r = occ[col];
      if (!r) { vacant++; potentialRevenue += rate; col++; continue; }
      booked++; bookedNights++;
      // First night of this occupant's run?
      const prev = col > 0 ? occ[col - 1] : null;
      if (prev === r) { col++; continue; } // (defensive — runs are consumed below)

      // Find run end.
      let end = col;
      while (end + 1 < days && occ[end + 1] === r) { end++; booked++; bookedNights++; }
      const startsInWindow = col > 0 || r.startDate >= dayDates[0];
      // Something (a check-out day or a turnover) follows within the window →
      // the body connects to it (flat trailing end).
      const hasAfter = end + 1 < days;

      if (prev && prev !== r) {
        // True turnover: prev checked out this morning, r checks in this afternoon.
        segments.push({ kind: "split", col, out: serializeRes(prev), in: serializeRes(r) });
        checkins++;
        if (end >= col + 1) segments.push({ kind: "body", from: col + 1, to: end, flatStart: false, flatEnd: hasAfter, res: serializeRes(r) });
      } else if (!startsInWindow) {
        // Ongoing from before the window — no check-in cell.
        segments.push({ kind: "body", from: col, to: end, flatStart: false, flatEnd: hasAfter, res: serializeRes(r) });
      } else {
        // Normal check-in (rendered as a half-day cell: morning free, night booked).
        segments.push({ kind: "arr", col, res: serializeRes(r) });
        checkins++;
        if (end >= col + 1) segments.push({ kind: "body", from: col + 1, to: end, flatStart: true, flatEnd: hasAfter, res: serializeRes(r) });
      }

      // Check-out day: if the next night is free (no turnover), show the morning
      // as an occupied half-cell on that day — which is still bookable as a new
      // check-in, so the user can see exactly which half is taken.
      if (hasAfter && occ[end + 1] === null) {
        segments.push({ kind: "checkout", col: end + 1, res: serializeRes(r) });
      }
      col = end + 1;
    }

    return {
      id: unit.id, name: unit.name, floor: unit.floor, unitType: unit.unitType,
      defaultDailyRate: rate, occupancyPct: days > 0 ? Math.round((booked / days) * 100) : 0, segments,
    };
  });

  const totalCells = units.length * days;
  return NextResponse.json({
    propertyName: property.name,
    startDate: startStr,
    endDate: endStr,
    dates,
    units: unitResults,
    stats: {
      totalCells,
      bookedNights,
      bookedPct: totalCells > 0 ? Math.round((bookedNights / totalCells) * 100) : 0,
      vacant,
      vacantPct: totalCells > 0 ? Math.round((vacant / totalCells) * 100) : 0,
      checkins,
      maintenance,
      potentialRevenue: potentialRevenue.toFixed(3),
    },
  });
}
