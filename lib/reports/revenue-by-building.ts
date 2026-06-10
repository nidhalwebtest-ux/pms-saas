import { prisma } from "@/lib/prisma";

/**
 * Revenue by Building report aggregation.
 *
 * Revenue counts only POSTING transactions:
 *   + issued invoices (status not DRAFT/CANCELLED/VOID), by invoice issueDate
 *   − active returns (credit notes), by return createdAt
 * Net revenue is grouped Building → Unit → Transaction (each invoice/return is
 * its own leaf row). Building = the unit's property, Unit = line-item unit.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface RevTxn {
  id: string;                       // unique row key (kind:refId:unit)
  kind: "invoice" | "return";
  refId: string;                    // invoice or return id (for the link)
  number: string;                   // INV-… / RET-…
  date: string;                     // ISO
  reservationId: string | null;
  reservationRef: string | null;
  guest: string;
  amount: number;                   // signed: invoices +, returns −
}
export interface RevUnit { id: string; name: string; revenue: number; transactions: RevTxn[]; }
export interface RevBuilding { id: string; name: string; unitCount: number; revenue: number; units: RevUnit[]; }
export interface RevReport {
  kpis: { totalRevenue: number; invoiced: number; returned: number; txCount: number; buildingCount: number; topPerformer: string | null; topPerformerRevenue: number; topPerformerPct: number; avgPerBuilding: number; };
  buildings: RevBuilding[];
  rangeDays: number;
}

export async function getRevenueByBuilding(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const units = await prisma.unit.findMany({
    where: { property: { organizationId: orgId }, ...(propertyId ? { propertyId } : {}) },
    select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
  });
  const unitInfo = new Map(units.map((u) => [u.id, { name: u.name, propertyId: u.propertyId, propertyName: u.property?.name ?? "—" }]));
  const unitsPerProp = new Map<string, number>();
  for (const u of units) unitsPerProp.set(u.propertyId, (unitsPerProp.get(u.propertyId) ?? 0) + 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, issueDate: true, propertyId: true, reservationId: true,
      property: { select: { name: true } },
      reservation: { select: { reservationNumber: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { unitId: true, lineTotal: true, unit: { select: { name: true } } } },
    },
  });

  const returns = await prisma.return.findMany({
    where: { organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive } },
    select: {
      id: true, returnNumber: true, createdAt: true, reservationId: true,
      invoice: { select: { propertyId: true } },
      reservation: { select: { reservationNumber: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { unitId: true, lineTotal: true } },
    },
  });

  type UAcc = { id: string; name: string; rev: number; tx: Map<string, RevTxn> };
  type BAcc = { id: string; name: string; rev: number; units: Map<string, UAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, rev: 0, units: new Map() }; buildings.set(pid, b); }
    return b;
  };
  const ensureU = (b: BAcc, uid: string, name: string): UAcc => {
    let u = b.units.get(uid);
    if (!u) { u = { id: uid, name, rev: 0, tx: new Map() }; b.units.set(uid, u); }
    return u;
  };

  // + invoices (one transaction row per invoice per unit)
  for (const inv of invoices) {
    const pid = inv.propertyId;
    if (!pid) continue;
    const b = ensureB(pid, inv.property?.name ?? "—");
    const guest = inv.reservation?.tenant ? `${inv.reservation.tenant.firstName ?? ""} ${inv.reservation.tenant.lastName ?? ""}`.trim() : "—";
    for (const li of inv.lineItems) {
      const uid = li.unitId ?? "—";
      const amt = Number(li.lineTotal);
      const u = ensureU(b, uid, li.unit?.name ?? unitInfo.get(uid)?.name ?? "—");
      u.rev = r3(u.rev + amt); b.rev = r3(b.rev + amt);
      const key = `inv:${inv.id}`;
      const ex = u.tx.get(key);
      if (ex) ex.amount = r3(ex.amount + amt);
      else u.tx.set(key, { id: `${key}:${uid}`, kind: "invoice", refId: inv.id, number: inv.invoiceNumber, date: inv.issueDate.toISOString(), reservationId: inv.reservationId, reservationRef: inv.reservation?.reservationNumber ?? null, guest, amount: amt });
    }
  }

  // − returns (one transaction row per return per unit; amount negative)
  for (const ret of returns) {
    const guest = ret.reservation?.tenant ? `${ret.reservation.tenant.firstName ?? ""} ${ret.reservation.tenant.lastName ?? ""}`.trim() : "—";
    for (const li of ret.lineItems) {
      const uid = li.unitId ?? undefined;
      const info = uid ? unitInfo.get(uid) : undefined;
      const pid = info?.propertyId ?? ret.invoice?.propertyId;
      if (!pid) continue;
      if (propertyId && pid !== propertyId) continue;
      const amt = Number(li.lineTotal);
      const b = ensureB(pid, info?.propertyName ?? "—");
      const u = ensureU(b, uid ?? "—", info?.name ?? "—");
      u.rev = r3(u.rev - amt); b.rev = r3(b.rev - amt);
      const key = `ret:${ret.id}`;
      const ex = u.tx.get(key);
      if (ex) ex.amount = r3(ex.amount - amt);
      else u.tx.set(key, { id: `${key}:${uid ?? "x"}`, kind: "return", refId: ret.id, number: ret.returnNumber, date: ret.createdAt.toISOString(), reservationId: ret.reservationId, reservationRef: ret.reservation?.reservationNumber ?? null, guest, amount: -amt });
    }
  }

  const buildingsOut: RevBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name, unitCount: unitsPerProp.get(b.id) ?? b.units.size, revenue: b.rev,
    units: [...b.units.values()].map((u) => ({
      id: u.id, name: u.name, revenue: u.rev,
      transactions: [...u.tx.values()].sort((a, c) => a.date.localeCompare(c.date)),
    })).sort((a, c) => c.revenue - a.revenue),
  })).sort((a, c) => c.revenue - a.revenue);

  const totalRevenue = r3(buildingsOut.reduce((s, b) => s + b.revenue, 0));
  let invoiced = 0, returned = 0, txCount = 0;
  for (const b of buildingsOut) for (const u of b.units) for (const tx of u.transactions) {
    txCount++;
    if (tx.amount >= 0) invoiced = r3(invoiced + tx.amount);
    else returned = r3(returned - tx.amount);
  }
  const top = buildingsOut[0];
  return {
    kpis: {
      totalRevenue,
      invoiced,
      returned,
      txCount,
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
