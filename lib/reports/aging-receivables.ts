import { prisma } from "@/lib/prisma";

/**
 * Aging Receivables — a point-in-time snapshot of OUTSTANDING invoice balances,
 * bucketed by how overdue they are as of the report date (the `to` date).
 *
 * Outstanding = balanceDue > 0 AND status in PENDING / PARTIALLY_PAID (+ legacy
 * DUE / ISSUED / PARTIAL). DRAFT (not issued), PAID, CANCELLED/VOID and RETURNED
 * are excluded. balanceDue is already stored net of payments and return credits.
 * Each invoice's whole balance falls into the single bucket of its dueDate:
 *   Current (not yet due) · 1–30 · 31–60 · 61–90 · 90+ days past due.
 * Grouped Building → Tenant → Invoice.
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const UNASSIGNED = "unassigned";

export type AgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";
export type Buckets = Record<AgingBucketKey, number>;
const zero = (): Buckets => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });
const addInto = (acc: Buckets, key: AgingBucketKey, amt: number) => { acc[key] = r3(acc[key] + amt); };
const sumOf = (b: Buckets) => r3(b.current + b.d1_30 + b.d31_60 + b.d61_90 + b.d90plus);

function bucketFor(daysOverdue: number): AgingBucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90plus";
}

export interface AgingInvoice {
  id: string;
  number: string;
  dueDate: string;       // ISO
  issueDate: string;     // ISO
  daysOverdue: number;   // ≤0 = current
  balance: number;
  bucket: AgingBucketKey;
}
export interface AgingTenant {
  id: string;
  name: string;
  buckets: Buckets;
  total: number;
  invoices: AgingInvoice[];
}
export interface AgingBuilding {
  id: string;
  name: string;
  tenantCount: number;
  buckets: Buckets;
  total: number;
  tenants: AgingTenant[];
}
export interface AgingReport {
  kpis: {
    totalDue: number;
    current: number;
    overdue: number;       // everything past due (d1_30 + … + d90plus)
    buckets: Buckets;      // org-wide totals per bucket
    invoiceCount: number;
    tenantCount: number;   // distinct tenants owing
    buildingCount: number;
  };
  buildings: AgingBuilding[];
  asOf: string;            // ISO yyyy-mm-dd
  rangeDays: number;
}

export async function getAgingReceivables(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<AgingReport> {
  const { orgId, to, propertyId } = params;
  const asOfMs = toDay(to);
  const asOfExclusive = new Date(asOfMs + DAY);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      // Outstanding = issued + still owing. Inlined (not a const array) so Prisma
      // infers the InvoiceStatus enum. Excludes DRAFT/PAID/CANCELLED/VOID/RETURNED.
      status: { in: ["PENDING", "PARTIALLY_PAID", "PARTIAL", "DUE", "ISSUED"] },
      balanceDue: { gt: 0 },
      issueDate: { lt: asOfExclusive },          // can't be receivable before it's issued
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, dueDate: true, issueDate: true, balanceDue: true,
      propertyId: true, property: { select: { name: true } },
      tenantId: true, tenant: { select: { firstName: true, lastName: true } },
    },
  });

  type TAcc = { id: string; name: string; buckets: Buckets; invoices: AgingInvoice[] };
  type BAcc = { id: string; name: string; buckets: Buckets; tenants: Map<string, TAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, buckets: zero(), tenants: new Map() }; buildings.set(pid, b); }
    return b;
  };
  const ensureT = (b: BAcc, tid: string, name: string): TAcc => {
    let t = b.tenants.get(tid);
    if (!t) { t = { id: tid, name, buckets: zero(), invoices: [] }; b.tenants.set(tid, t); }
    return t;
  };
  const tenantNames = new Set<string>();

  for (const inv of invoices) {
    const balance = Number(inv.balanceDue);
    if (balance <= 0) continue;
    const daysOverdue = Math.round((asOfMs - toDay(inv.dueDate)) / DAY);
    const bucket = bucketFor(daysOverdue);

    const pid = inv.propertyId ?? UNASSIGNED;
    const pname = inv.property?.name ?? "—";
    const guest = inv.tenant ? `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "—" : "—";

    const b = ensureB(pid, pname);
    const t = ensureT(b, inv.tenantId, guest);
    addInto(b.buckets, bucket, balance);
    addInto(t.buckets, bucket, balance);
    t.invoices.push({
      id: inv.id, number: inv.invoiceNumber,
      dueDate: inv.dueDate.toISOString(), issueDate: inv.issueDate.toISOString(),
      daysOverdue, balance: r3(balance), bucket,
    });
    tenantNames.add(inv.tenantId);
  }

  const buildingsOut: AgingBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name,
    tenantCount: b.tenants.size,
    buckets: b.buckets,
    total: sumOf(b.buckets),
    tenants: [...b.tenants.values()].map((t) => ({
      id: t.id, name: t.name, buckets: t.buckets, total: sumOf(t.buckets),
      invoices: t.invoices.sort((a, c) => c.daysOverdue - a.daysOverdue),
    })).sort((a, c) => c.total - a.total),
  })).sort((a, c) => c.total - a.total);

  const orgBuckets = zero();
  let invoiceCount = 0;
  for (const b of buildingsOut) {
    (Object.keys(orgBuckets) as AgingBucketKey[]).forEach((k) => { orgBuckets[k] = r3(orgBuckets[k] + b.buckets[k]); });
    for (const t of b.tenants) invoiceCount += t.invoices.length;
  }
  const totalDue = sumOf(orgBuckets);
  const overdue = r3(orgBuckets.d1_30 + orgBuckets.d31_60 + orgBuckets.d61_90 + orgBuckets.d90plus);

  return {
    kpis: {
      totalDue,
      current: orgBuckets.current,
      overdue,
      buckets: orgBuckets,
      invoiceCount,
      tenantCount: tenantNames.size,
      buildingCount: buildingsOut.length,
    },
    buildings: buildingsOut,
    asOf: new Date(asOfMs).toISOString().slice(0, 10),
    rangeDays: 1,
  };
}
