import { prisma } from "@/lib/prisma";
import type { RevReport, RevBuilding, RevTxn } from "./revenue-by-building";

/**
 * Revenue by Source — same posting-transaction basis as Revenue by Building,
 * grouped by the reservation's booking SOURCE → Building → Transaction. The
 * top-level "building" slot carries the source CODE (walk_in / phone / …); the
 * view translates it via tenants.sources. Invoices/returns with no reservation
 * fall under an "unknown" bucket.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const UNKNOWN = "other";   // bucket for invoices/returns with no reservation source; maps to tenants.sources.other

export async function getRevenueBySource(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<RevReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

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
      reservation: { select: { reservationNumber: true, source: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { lineTotal: true } },
    },
  });

  const returns = await prisma.return.findMany({
    where: { organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive } },
    select: {
      id: true, returnNumber: true, createdAt: true, reservationId: true,
      invoice: { select: { propertyId: true, property: { select: { name: true } } } },
      reservation: { select: { reservationNumber: true, source: true, tenant: { select: { firstName: true, lastName: true } } } },
      lineItems: { select: { lineTotal: true } },
    },
  });

  type BAcc = { id: string; name: string; rev: number; tx: Map<string, RevTxn> };   // building under a source
  type SAcc = { id: string; rev: number; buildings: Map<string, BAcc> };
  const sources = new Map<string, SAcc>();
  const ensureS = (code: string): SAcc => {
    let s = sources.get(code);
    if (!s) { s = { id: code, rev: 0, buildings: new Map() }; sources.set(code, s); }
    return s;
  };
  const ensureB = (s: SAcc, pid: string, name: string): BAcc => {
    let b = s.buildings.get(pid);
    if (!b) { b = { id: pid, name, rev: 0, tx: new Map() }; s.buildings.set(pid, b); }
    return b;
  };
  const guestOf = (r?: { tenant: { firstName: string | null; lastName: string | null } | null } | null) =>
    r?.tenant ? `${r.tenant.firstName ?? ""} ${r.tenant.lastName ?? ""}`.trim() || "—" : "—";

  for (const inv of invoices) {
    const pid = inv.propertyId;
    if (!pid) continue;
    const code = inv.reservation?.source || UNKNOWN;
    const amt = r3(inv.lineItems.reduce((acc, li) => acc + Number(li.lineTotal), 0));
    const s = ensureS(code);
    const b = ensureB(s, pid, inv.property?.name ?? "—");
    s.rev = r3(s.rev + amt); b.rev = r3(b.rev + amt);
    b.tx.set(`inv:${inv.id}`, { id: `inv:${inv.id}`, kind: "invoice", refId: inv.id, number: inv.invoiceNumber, date: inv.issueDate.toISOString(), reservationId: inv.reservationId, reservationRef: inv.reservation?.reservationNumber ?? null, guest: guestOf(inv.reservation), amount: amt });
  }

  for (const ret of returns) {
    const pid = ret.invoice?.propertyId;
    if (!pid) continue;
    if (propertyId && pid !== propertyId) continue;
    const code = ret.reservation?.source || UNKNOWN;
    const amt = r3(ret.lineItems.reduce((acc, li) => acc + Number(li.lineTotal), 0));
    const s = ensureS(code);
    const b = ensureB(s, pid, ret.invoice?.property?.name ?? "—");
    s.rev = r3(s.rev - amt); b.rev = r3(b.rev - amt);
    b.tx.set(`ret:${ret.id}`, { id: `ret:${ret.id}`, kind: "return", refId: ret.id, number: ret.returnNumber, date: ret.createdAt.toISOString(), reservationId: ret.reservationId, reservationRef: ret.reservation?.reservationNumber ?? null, guest: guestOf(ret.reservation), amount: -amt });
  }

  const buildingsOut: RevBuilding[] = [...sources.values()].map((s) => ({
    id: s.id, name: s.id, unitCount: s.buildings.size, revenue: s.rev,
    units: [...s.buildings.values()].map((b) => ({
      id: b.id, name: b.name, revenue: b.rev,
      transactions: [...b.tx.values()].sort((a, c) => a.date.localeCompare(c.date)),
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
