import { prisma } from "@/lib/prisma";

/**
 * Revenue by Building report aggregation.
 *
 * Revenue counts only POSTING transactions:
 *   + issued invoices (status not DRAFT/CANCELLED/VOID), by invoice issueDate
 *   − active returns (credit notes), by return createdAt
 * Net revenue is grouped Building → Unit → Reservation. Building = the unit's
 * property, Unit = line-item unit, Reservation = the invoice/return reservation.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface RevReservation { id: string; ref: string | null; guest: string; nights: number; revenue: number; }
export interface RevUnit { id: string; name: string; revenue: number; reservations: RevReservation[]; }
export interface RevBuilding { id: string; name: string; unitCount: number; revenue: number; units: RevUnit[]; }
export interface RevReport {
  kpis: { totalRevenue: number; buildingCount: number; topPerformer: string | null; topPerformerRevenue: number; topPerformerPct: number; avgPerBuilding: number; };
  buildings: RevBuilding[];
  rangeDays: number;
}

export async function getRevenueByBuilding(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;            // make `to` an inclusive day
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  // Units (names + property + count). Property-scoped when a building is selected.
  const units = await prisma.unit.findMany({
    where: { property: { organizationId: orgId }, ...(propertyId ? { propertyId } : {}) },
    select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
  });
  const unitInfo = new Map(units.map((u) => [u.id, { name: u.name, propertyId: u.propertyId, propertyName: u.property?.name ?? "—" }]));
  const unitsPerProp = new Map<string, number>();
  for (const u of units) unitsPerProp.set(u.propertyId, (unitsPerProp.get(u.propertyId) ?? 0) + 1);

  // Issued invoices in range
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      propertyId: true, reservationId: true,
      property: { select: { name: true } },
      reservation: { select: { reservationNumber: true, startDate: true, endDate: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { unitId: true, lineTotal: true, unit: { select: { name: true } } } },
    },
  });

  // Active returns in range (credit notes that reduce revenue)
  const returns = await prisma.return.findMany({
    where: { organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive } },
    select: {
      reservationId: true,
      invoice: { select: { propertyId: true } },
      lineItems: { select: { unitId: true, lineTotal: true } },
    },
  });

  type RAcc = { id: string; ref: string | null; guest: string; rev: number; nights: number };
  type UAcc = { id: string; name: string; rev: number; res: Map<string, RAcc> };
  type BAcc = { id: string; name: string; rev: number; units: Map<string, UAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, rev: 0, units: new Map() }; buildings.set(pid, b); }
    return b;
  };
  const ensureU = (b: BAcc, uid: string, name: string): UAcc => {
    let u = b.units.get(uid);
    if (!u) { u = { id: uid, name, rev: 0, res: new Map() }; b.units.set(uid, u); }
    return u;
  };

  // + invoices
  for (const inv of invoices) {
    const pid = inv.propertyId;
    if (!pid) continue;
    const b = ensureB(pid, inv.property?.name ?? "—");
    const nights = inv.reservation ? Math.max(1, Math.round((toDay(inv.reservation.endDate) - toDay(inv.reservation.startDate)) / DAY)) : 0;
    const guest = inv.reservation?.tenant ? `${inv.reservation.tenant.firstName ?? ""} ${inv.reservation.tenant.lastName ?? ""}`.trim() : "—";
    for (const li of inv.lineItems) {
      const uid = li.unitId ?? "—";
      const amt = Number(li.lineTotal);
      const u = ensureU(b, uid, li.unit?.name ?? unitInfo.get(uid)?.name ?? "—");
      u.rev = r3(u.rev + amt); b.rev = r3(b.rev + amt);
      if (inv.reservationId) {
        let rr = u.res.get(inv.reservationId);
        if (!rr) { rr = { id: inv.reservationId, ref: inv.reservation?.reservationNumber ?? null, guest, rev: 0, nights }; u.res.set(inv.reservationId, rr); }
        rr.rev = r3(rr.rev + amt);
      }
    }
  }

  // − returns (attributed to the line-item unit's property)
  for (const ret of returns) {
    for (const li of ret.lineItems) {
      const uid = li.unitId ?? undefined;
      const info = uid ? unitInfo.get(uid) : undefined;
      const pid = info?.propertyId ?? ret.invoice?.propertyId;
      if (!pid) continue;
      if (propertyId && pid !== propertyId) continue;       // scope when a building is selected
      const amt = Number(li.lineTotal);
      const b = ensureB(pid, info?.propertyName ?? "—");
      const u = ensureU(b, uid ?? "—", info?.name ?? "—");
      u.rev = r3(u.rev - amt); b.rev = r3(b.rev - amt);
      if (ret.reservationId) {
        const rr = u.res.get(ret.reservationId);
        if (rr) rr.rev = r3(rr.rev - amt);
      }
    }
  }

  const buildingsOut: RevBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name, unitCount: unitsPerProp.get(b.id) ?? b.units.size, revenue: b.rev,
    units: [...b.units.values()].map((u) => ({
      id: u.id, name: u.name, revenue: u.rev,
      reservations: [...u.res.values()].sort((a, c) => c.rev - a.rev).map((rr) => ({ id: rr.id, ref: rr.ref, guest: rr.guest, nights: rr.nights, revenue: rr.rev })),
    })).sort((a, c) => c.revenue - a.revenue),
  })).sort((a, c) => c.revenue - a.revenue);

  const totalRevenue = r3(buildingsOut.reduce((s, b) => s + b.revenue, 0));
  const top = buildingsOut[0];
  return {
    kpis: {
      totalRevenue,
      buildingCount: buildingsOut.length,
      topPerformer: top?.name ?? null,
      topPerformerRevenue: top?.revenue ?? 0,
      topPerformerPct: totalRevenue > 0 && top ? r3((top.revenue / totalRevenue) * 100) : 0,
      avgPerBuilding: buildingsOut.length > 0 ? r3(totalRevenue / buildingsOut.length) : 0,
    },
    buildings: buildingsOut,
    rangeDays,
  };
}
