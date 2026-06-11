import { prisma } from "@/lib/prisma";

/**
 * Tenant Reports — a tenant value/activity leaderboard for the period.
 *
 * Per tenant (with activity in the window — a reservation or an issued invoice):
 *   stays    = reservations started in the period (excl. CANCELLED/NO_SHOW)
 *   nights   = Σ totalNights of those reservations
 *   revenue  = net posting revenue (issued invoices − active returns) in period
 *   balance  = current outstanding (open invoice balances as of `to`)
 * Plus classification / source / type badges and "new this period" flag
 * (firstStayDate within the window). Revenue & stays are period-scoped; balance
 * is point-in-time. Building filter is best-effort.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface TenantRow {
  id: string;
  name: string;
  classification: string;
  source: string;
  tenantType: string;
  isNew: boolean;
  lastStay: string | null;
  stays: number;
  nights: number;
  revenue: number;
  balance: number;
}
export interface TenantReport {
  kpis: {
    tenantCount: number;
    newCount: number;
    revenue: number;
    balance: number;
    nights: number;
    topName: string | null;
    topRevenue: number;
  };
  tenants: TenantRow[];
  rangeDays: number;
}

export async function getTenantReports(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<TenantReport> {
  const { orgId, from, to, propertyId } = params;
  const fromMs = toDay(from);
  const toExclusiveMs = toDay(to) + DAY;
  const rangeDays = Math.max(1, Math.round((toExclusiveMs - fromMs) / DAY));
  const rangeFrom = new Date(fromMs);
  const rangeToExclusive = new Date(toExclusiveMs);

  const resPropertyFilter = propertyId
    ? { OR: [{ unit: { propertyId } }, { reservationUnits: { some: { unit: { propertyId } } } }] }
    : {};

  const [reservations, invoices, returns, openInvoices] = await Promise.all([
    prisma.reservation.findMany({
      where: { organizationId: orgId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, startDate: { gte: rangeFrom, lt: rangeToExclusive }, ...resPropertyFilter },
      select: { tenantId: true, totalNights: true, startDate: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId, status: { notIn: ["DRAFT", "CANCELLED", "VOID"] }, issueDate: { gte: rangeFrom, lt: rangeToExclusive }, ...(propertyId ? { propertyId } : {}) },
      select: { tenantId: true, lineItems: { select: { lineTotal: true } } },
    }),
    prisma.return.findMany({
      where: { organizationId: orgId, status: "active", createdAt: { gte: rangeFrom, lt: rangeToExclusive }, ...(propertyId ? { invoice: { propertyId } } : {}) },
      select: { tenantId: true, lineItems: { select: { lineTotal: true } } },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId, status: { in: ["PENDING", "PARTIALLY_PAID", "PARTIAL", "DUE", "ISSUED"] }, balanceDue: { gt: 0 }, issueDate: { lt: rangeToExclusive }, ...(propertyId ? { propertyId } : {}) },
      select: { tenantId: true, balanceDue: true },
    }),
  ]);

  type Acc = { stays: number; nights: number; revenue: number; balance: number; lastStart: number };
  const byTenant = new Map<string, Acc>();
  const active = new Set<string>();          // tenants with period activity (reservation or invoice)
  const ensure = (id: string): Acc => {
    let a = byTenant.get(id);
    if (!a) { a = { stays: 0, nights: 0, revenue: 0, balance: 0, lastStart: 0 }; byTenant.set(id, a); }
    return a;
  };

  for (const r of reservations) {
    const a = ensure(r.tenantId); active.add(r.tenantId);
    a.stays++; a.nights += r.totalNights;
    a.lastStart = Math.max(a.lastStart, r.startDate.getTime());
  }
  for (const inv of invoices) {
    const a = ensure(inv.tenantId); active.add(inv.tenantId);
    a.revenue = r3(a.revenue + inv.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
  }
  for (const ret of returns) {
    if (!ret.tenantId) continue;
    const a = ensure(ret.tenantId);
    a.revenue = r3(a.revenue - ret.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0));
  }
  for (const inv of openInvoices) {
    ensure(inv.tenantId).balance = r3((byTenant.get(inv.tenantId)?.balance ?? 0) + Number(inv.balanceDue));
  }

  // Only tenants with period activity make the report (balance-only tenants excluded).
  const ids = [...active];
  const tenants = ids.length
    ? await prisma.tenant.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, classification: true, source: true, tenantType: true, firstStayDate: true, lastStayDate: true },
      })
    : [];
  const info = new Map(tenants.map((t) => [t.id, t]));

  const rows: TenantRow[] = ids.map((id) => {
    const a = byTenant.get(id)!;
    const t = info.get(id);
    const name = t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—" : "—";
    const firstStay = t?.firstStayDate ? t.firstStayDate.getTime() : null;
    return {
      id, name,
      classification: t?.classification ?? "regular",
      source: t?.source ?? "walk_in",
      tenantType: t?.tenantType ?? "individual",
      isNew: firstStay !== null && firstStay >= fromMs && firstStay < toExclusiveMs,
      lastStay: a.lastStart > 0 ? new Date(a.lastStart).toISOString() : (t?.lastStayDate?.toISOString() ?? null),
      stays: a.stays, nights: a.nights, revenue: a.revenue, balance: a.balance,
    };
  }).sort((x, y) => y.revenue - x.revenue || y.balance - x.balance);

  const sum = (sel: (r: TenantRow) => number) => r3(rows.reduce((s, r) => s + sel(r), 0));
  const top = rows[0];

  return {
    kpis: {
      tenantCount: rows.length,
      newCount: rows.filter((r) => r.isNew).length,
      revenue: sum((r) => r.revenue),
      balance: sum((r) => r.balance),
      nights: rows.reduce((s, r) => s + r.nights, 0),
      topName: top?.name ?? null,
      topRevenue: top?.revenue ?? 0,
    },
    tenants: rows,
    rangeDays,
  };
}
