import { prisma } from "@/lib/prisma";
import type { RevReport, RevBuilding, RevTxn } from "./revenue-by-building";

/**
 * Revenue by Tenant — same posting-transaction basis as Revenue by Building,
 * but grouped Building → Tenant → Transaction (each invoice +, each return −).
 * Revenue = issued invoices (by issueDate) minus active returns (by createdAt).
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export async function getRevenueByTenant(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const props = await prisma.property.findMany({
    where: { organizationId: orgId, ...(propertyId ? { id: propertyId } : {}) },
    select: { id: true, name: true },
  });
  const propName = new Map(props.map((p) => [p.id, p.name]));

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["DRAFT", "CANCELLED", "VOID"] },
      issueDate: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, issueDate: true, propertyId: true, tenantId: true, reservationId: true,
      tenant: { select: { firstName: true, lastName: true } },
      reservation: { select: { reservationNumber: true } },
      lineItems: { select: { lineTotal: true } },
    },
  });

  const returns = await prisma.return.findMany({
    where: {
      organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive },
      ...(propertyId ? { invoice: { propertyId } } : {}),
    },
    select: {
      id: true, returnNumber: true, createdAt: true, tenantId: true, reservationId: true,
      invoice: { select: { propertyId: true } },
      tenant: { select: { firstName: true, lastName: true } },
      reservation: { select: { reservationNumber: true } },
      lineItems: { select: { lineTotal: true } },
    },
  });

  type TAcc = { id: string; name: string; rev: number; tx: Map<string, RevTxn> };
  type BAcc = { id: string; name: string; rev: number; tenants: Map<string, TAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name: propName.get(pid) ?? "—", rev: 0, tenants: new Map() }; buildings.set(pid, b); }
    return b;
  };
  const ensureT = (b: BAcc, tid: string, name: string): TAcc => {
    let tt = b.tenants.get(tid);
    if (!tt) { tt = { id: tid, name, rev: 0, tx: new Map() }; b.tenants.set(tid, tt); }
    return tt;
  };
  const nameOf = (t?: { firstName: string | null; lastName: string | null } | null) =>
    t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—" : "—";

  // + invoices (one row per invoice under building → tenant)
  for (const inv of invoices) {
    if (!inv.propertyId) continue;
    const amt = r3(inv.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
    const b = ensureB(inv.propertyId);
    const guest = nameOf(inv.tenant);
    const tt = ensureT(b, inv.tenantId, guest);
    b.rev = r3(b.rev + amt); tt.rev = r3(tt.rev + amt);
    tt.tx.set(`inv:${inv.id}`, { id: `inv:${inv.id}`, kind: "invoice", refId: inv.id, number: inv.invoiceNumber, date: inv.issueDate.toISOString(), reservationId: inv.reservationId, reservationRef: inv.reservation?.reservationNumber ?? null, guest, amount: amt });
  }

  // − returns
  for (const ret of returns) {
    const pid = ret.invoice?.propertyId;
    if (!pid) continue;
    if (propertyId && pid !== propertyId) continue;
    const amt = r3(ret.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
    const b = ensureB(pid);
    const guest = nameOf(ret.tenant);
    const tt = ensureT(b, ret.tenantId, guest);
    b.rev = r3(b.rev - amt); tt.rev = r3(tt.rev - amt);
    tt.tx.set(`ret:${ret.id}`, { id: `ret:${ret.id}`, kind: "return", refId: ret.id, number: ret.returnNumber, date: ret.createdAt.toISOString(), reservationId: ret.reservationId, reservationRef: ret.reservation?.reservationNumber ?? null, guest, amount: -amt });
  }

  const buildingsOut: RevBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name, unitCount: b.tenants.size, revenue: b.rev,
    units: [...b.tenants.values()].map((tt) => ({
      id: tt.id, name: tt.name, revenue: tt.rev,
      transactions: [...tt.tx.values()].sort((a, c) => a.date.localeCompare(c.date)),
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
