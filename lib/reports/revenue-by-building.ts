import { prisma } from "@/lib/prisma";

/**
 * Revenue by Building report aggregation.
 *
 * Revenue = sum of issued invoice line-item totals (status not DRAFT/CANCELLED/
 * VOID) by invoice issueDate. Building = invoice property, Unit = line-item unit,
 * Reservation = invoice reservation. YTD = Jan 1 (of range end) → range end.
 * Occupancy = reserved nights ÷ available nights in the range; Avg rate =
 * revenue ÷ reserved nights; vs = delta against the prior equal-length period.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface RevReservation { id: string; ref: string | null; guest: string; nights: number; revenue: number; status: "paid" | "due" | "overdue" | null; }
export interface RevUnit { id: string; name: string; revenue: number; revenueYtd: number; occupancy: number | null; tone: "success" | "warning"; rate: number | null; delta: number | null; reservations: RevReservation[]; }
export interface RevBuilding { id: string; name: string; unitCount: number; revenue: number; revenueYtd: number; occupancy: number | null; tone: "success" | "warning"; rate: number | null; delta: number | null; units: RevUnit[]; }
export interface RevReport {
  kpis: { totalRevenue: number; buildingCount: number; topPerformer: string | null; topPerformerRevenue: number; topPerformerPct: number; avgPerBuilding: number; adr: number | null; delta: number | null; };
  buildings: RevBuilding[];
  rangeDays: number;
}

const tone = (occ: number | null): "success" | "warning" => (occ != null && occ >= 0.85 ? "success" : "warning");

export async function getRevenueByBuilding(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;            // make `to` an inclusive day
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const ytdStart = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
  const priorFrom = new Date(fromMs - rangeDays * DAY);
  const priorTo = new Date(fromMs - DAY);

  const propFilter = propertyId ? { propertyId } : {};

  // ── Invoices (issued) from YTD start through range end ──────────────────────
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: ytdStart, lte: to },
      ...propFilter,
    },
    select: {
      issueDate: true, propertyId: true, reservationId: true,
      property: { select: { name: true } },
      reservation: { select: { reservationNumber: true, startDate: true, endDate: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { unitId: true, lineTotal: true, unit: { select: { name: true } } } },
    },
  });

  // ── Units (for occupancy denominator + names) ──────────────────────────────
  const units = await prisma.unit.findMany({
    where: { property: { organizationId: orgId }, ...(propertyId ? { propertyId } : {}) },
    select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
  });

  // ── Reservations overlapping the period (for nights/occupancy/ADR) ─────────
  const reservations = await prisma.reservation.findMany({
    where: {
      tenant: { organizationId: orgId },
      status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] },
      startDate: { lt: new Date(toExclusiveMs) },
      endDate: { gt: from },
      ...(propertyId ? { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] } : {}),
    },
    select: {
      startDate: true, endDate: true, unitId: true,
      reservationUnits: { select: { unitId: true } },
    },
  });

  // Reserved nights per unit within [from, toExclusive)
  const nightsByUnit = new Map<string, number>();
  for (const res of reservations) {
    const s = Math.max(toDay(res.startDate), fromMs);
    const e = Math.min(toDay(res.endDate), toExclusiveMs);
    const n = Math.max(0, Math.round((e - s) / DAY));
    if (n === 0) continue;
    const unitIds = new Set<string>([...(res.unitId ? [res.unitId] : []), ...res.reservationUnits.map((ru) => ru.unitId)]);
    for (const uid of unitIds) nightsByUnit.set(uid, (nightsByUnit.get(uid) ?? 0) + n);
  }

  // ── Aggregate revenue ──────────────────────────────────────────────────────
  type UAcc = { id: string; name: string; rev: number; ytd: number; res: Map<string, { id: string; ref: string | null; guest: string; rev: number; nights: number }> };
  type BAcc = { id: string; name: string; rev: number; ytd: number; priorRev: number; units: Map<string, UAcc> };
  const buildings = new Map<string, BAcc>();
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const unitsPerProp = new Map<string, number>();
  for (const u of units) unitsPerProp.set(u.propertyId, (unitsPerProp.get(u.propertyId) ?? 0) + 1);

  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, rev: 0, ytd: 0, priorRev: 0, units: new Map() }; buildings.set(pid, b); }
    return b;
  };

  for (const inv of invoices) {
    const pid = inv.propertyId;
    if (!pid) continue;
    const b = ensureB(pid, inv.property?.name ?? "—");
    const inPeriod = toDay(inv.issueDate) >= fromMs && toDay(inv.issueDate) < toExclusiveMs;
    const resNights = inv.reservation ? Math.max(1, Math.round((toDay(inv.reservation.endDate) - toDay(inv.reservation.startDate)) / DAY)) : 0;
    const guest = inv.reservation?.tenant ? `${inv.reservation.tenant.firstName ?? ""} ${inv.reservation.tenant.lastName ?? ""}`.trim() : "—";
    for (const li of inv.lineItems) {
      const uid = li.unitId ?? "—";
      const amt = Number(li.lineTotal);
      let u = b.units.get(uid);
      if (!u) { u = { id: uid, name: li.unit?.name ?? unitName.get(uid) ?? "—", rev: 0, ytd: 0, res: new Map() }; b.units.set(uid, u); }
      u.ytd = r3(u.ytd + amt); b.ytd = r3(b.ytd + amt);
      if (inPeriod) {
        u.rev = r3(u.rev + amt); b.rev = r3(b.rev + amt);
        if (inv.reservationId) {
          let rr = u.res.get(inv.reservationId);
          if (!rr) { rr = { id: inv.reservationId, ref: inv.reservation?.reservationNumber ?? null, guest, rev: 0, nights: resNights }; u.res.set(inv.reservationId, rr); }
          rr.rev = r3(rr.rev + amt);
        }
      }
    }
  }

  // Prior-period revenue per building (for delta)
  const priorInvoices = await prisma.invoice.findMany({
    where: { organizationId: orgId, status: { notIn: ["DRAFT", "CANCELLED", "VOID"] }, issueDate: { gte: priorFrom, lte: priorTo }, ...propFilter },
    select: { propertyId: true, lineItems: { select: { lineTotal: true } } },
  });
  for (const inv of priorInvoices) {
    if (!inv.propertyId) continue;
    const b = buildings.get(inv.propertyId);
    if (!b) continue;
    for (const li of inv.lineItems) b.priorRev = r3(b.priorRev + Number(li.lineTotal));
  }

  // ── Shape output ───────────────────────────────────────────────────────────
  const buildingsOut: RevBuilding[] = [...buildings.values()].map((b) => {
    const unitCount = unitsPerProp.get(b.id) ?? b.units.size;
    let bldNights = 0;
    const unitsOut: RevUnit[] = [...b.units.values()].map((u) => {
      const n = nightsByUnit.get(u.id) ?? 0;
      bldNights += n;
      const occ = u.id !== "—" ? Math.min(1, n / rangeDays) : null;
      const reservations: RevReservation[] = [...u.res.values()]
        .sort((a, c) => c.rev - a.rev)
        .map((rr) => ({ id: rr.id, ref: rr.ref, guest: rr.guest, nights: rr.nights, revenue: rr.rev, status: null }));
      return {
        id: u.id, name: u.name, revenue: u.rev, revenueYtd: u.ytd,
        occupancy: occ, tone: tone(occ), rate: n > 0 ? r3(u.rev / n) : null, delta: null, reservations,
      };
    }).sort((a, c) => c.revenue - a.revenue);

    const bOcc = unitCount > 0 ? Math.min(1, bldNights / (unitCount * rangeDays)) : null;
    const delta = b.priorRev > 0 ? r3(((b.rev - b.priorRev) / b.priorRev) * 100) : null;
    return {
      id: b.id, name: b.name, unitCount, revenue: b.rev, revenueYtd: b.ytd,
      occupancy: bOcc, tone: tone(bOcc), rate: bldNights > 0 ? r3(b.rev / bldNights) : null, delta, units: unitsOut,
    };
  }).sort((a, c) => c.revenue - a.revenue);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalRevenue = r3(buildingsOut.reduce((s, b) => s + b.revenue, 0));
  const totalPrior = r3(priorInvoices.reduce((s, inv) => s + inv.lineItems.reduce((x, li) => x + Number(li.lineTotal), 0), 0));
  const totalNights = [...nightsByUnit.values()].reduce((s, n) => s + n, 0);
  const top = buildingsOut[0];
  return {
    kpis: {
      totalRevenue,
      buildingCount: buildingsOut.length,
      topPerformer: top?.name ?? null,
      topPerformerRevenue: top?.revenue ?? 0,
      topPerformerPct: totalRevenue > 0 && top ? r3((top.revenue / totalRevenue) * 100) : 0,
      avgPerBuilding: buildingsOut.length > 0 ? r3(totalRevenue / buildingsOut.length) : 0,
      adr: totalNights > 0 ? r3(totalRevenue / totalNights) : null,
      delta: totalPrior > 0 ? r3(((totalRevenue - totalPrior) / totalPrior) * 100) : null,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
