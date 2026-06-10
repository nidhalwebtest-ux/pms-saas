import { prisma } from "@/lib/prisma";
import type { RevReport, RevBuilding, RevTxn } from "./revenue-by-building";

/**
 * Revenue by Unit Type — same posting-transaction basis as Revenue by Building
 * (issued invoices + minus active returns −), but grouped Unit Type → Unit →
 * Transaction. The top-level "building" slot carries the unit-type CODE
 * (STUDIO / ONE_BR / …); the view translates it via reservations.detail.unitTypes.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const OTHER = "OTHER";   // bucket for line items with no resolvable unit type

export async function getRevenueByUnitType(params: {
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
    select: { id: true, name: true, unitType: true },
  });
  const unitInfo = new Map(units.map((u) => [u.id, { name: u.name, type: u.unitType || "—" }]));
  const unitsPerType = new Map<string, number>();
  for (const u of units) unitsPerType.set(u.unitType || "—", (unitsPerType.get(u.unitType || "—") ?? 0) + 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, issueDate: true, reservationId: true,
      reservation: { select: { reservationNumber: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { unitId: true, lineTotal: true, unit: { select: { name: true, unitType: true } } } },
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
  type TAcc = { id: string; rev: number; units: Map<string, UAcc> };
  const types = new Map<string, TAcc>();
  const ensureT = (code: string): TAcc => {
    let t = types.get(code);
    if (!t) { t = { id: code, rev: 0, units: new Map() }; types.set(code, t); }
    return t;
  };
  const ensureU = (t: TAcc, uid: string, name: string): UAcc => {
    let u = t.units.get(uid);
    if (!u) { u = { id: uid, name, rev: 0, tx: new Map() }; t.units.set(uid, u); }
    return u;
  };
  const guestOf = (r?: { tenant: { firstName: string | null; lastName: string | null } | null } | null) =>
    r?.tenant ? `${r.tenant.firstName ?? ""} ${r.tenant.lastName ?? ""}`.trim() || "—" : "—";

  for (const inv of invoices) {
    const guest = guestOf(inv.reservation);
    for (const li of inv.lineItems) {
      const uid = li.unitId;
      // unitId present but outside scope (property filter) → skip; else bucket under its type or OTHER.
      if (uid && propertyId && !unitInfo.has(uid)) continue;
      const code = (uid ? li.unit?.unitType || unitInfo.get(uid)?.type : null) || OTHER;
      const unitKey = uid ?? OTHER;
      const unitName = uid ? li.unit?.name ?? unitInfo.get(uid)?.name ?? "—" : "—";
      const amt = Number(li.lineTotal);
      const t = ensureT(code);
      const u = ensureU(t, unitKey, unitName);
      u.rev = r3(u.rev + amt); t.rev = r3(t.rev + amt);
      const key = `inv:${inv.id}`;
      const ex = u.tx.get(key);
      if (ex) ex.amount = r3(ex.amount + amt);
      else u.tx.set(key, { id: `${key}:${unitKey}`, kind: "invoice", refId: inv.id, number: inv.invoiceNumber, date: inv.issueDate.toISOString(), reservationId: inv.reservationId, reservationRef: inv.reservation?.reservationNumber ?? null, guest, amount: amt });
    }
  }

  for (const ret of returns) {
    const guest = guestOf(ret.reservation);
    for (const li of ret.lineItems) {
      const uid = li.unitId;
      const info = uid ? unitInfo.get(uid) : undefined;
      // Respect property filter: a unit in another property, or a unit-less
      // return whose invoice is in another property, is out of scope.
      if (propertyId) {
        if (uid && !info) continue;
        if (!uid && ret.invoice?.propertyId !== propertyId) continue;
      }
      const code = info?.type || OTHER;
      const unitKey = uid ?? OTHER;
      const unitName = info?.name ?? "—";
      const amt = Number(li.lineTotal);
      const t = ensureT(code);
      const u = ensureU(t, unitKey, unitName);
      u.rev = r3(u.rev - amt); t.rev = r3(t.rev - amt);
      const key = `ret:${ret.id}`;
      const ex = u.tx.get(key);
      if (ex) ex.amount = r3(ex.amount - amt);
      else u.tx.set(key, { id: `${key}:${unitKey}`, kind: "return", refId: ret.id, number: ret.returnNumber, date: ret.createdAt.toISOString(), reservationId: ret.reservationId, reservationRef: ret.reservation?.reservationNumber ?? null, guest, amount: -amt });
    }
  }

  const buildingsOut: RevBuilding[] = [...types.values()].map((t) => ({
    id: t.id, name: t.id, unitCount: unitsPerType.get(t.id) ?? t.units.size, revenue: t.rev,
    units: [...t.units.values()].map((u) => ({
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
      totalRevenue, invoiced, returned, txCount,
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
