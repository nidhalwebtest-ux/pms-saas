import { prisma } from "@/lib/prisma";

/**
 * Outstanding Balances — the debtor ledger as of the report date. For every
 * invoice that still has a balance (balanceDue > 0, status PENDING/PARTIALLY_PAID
 * + legacy DUE/ISSUED/PARTIAL; DRAFT/PAID/CANCELLED/VOID/RETURNED excluded), it
 * shows the money breakdown — invoiced (totalAmount), paid (amountPaid), credited
 * (return credits), balance — grouped Building → Tenant → Invoice. Complements
 * Aging Receivables (which buckets the same balances by age instead).
 * balanceDue = totalAmount − amountPaid − creditedAmount (stored).
 */

const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const toDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const UNASSIGNED = "unassigned";

export interface OsInvoice {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  issueDate: string;
  daysOverdue: number;   // ≤0 = not yet due
  invoiced: number;
  paid: number;
  credited: number;
  balance: number;
}
export interface OsTenant {
  id: string;
  name: string;
  invoiced: number;
  paid: number;
  credited: number;
  balance: number;
  invoices: OsInvoice[];
}
export interface OsBuilding {
  id: string;
  name: string;
  tenantCount: number;
  invoiced: number;
  paid: number;
  credited: number;
  balance: number;
  tenants: OsTenant[];
}
export interface OsReport {
  kpis: {
    balance: number;
    invoiced: number;
    paid: number;
    credited: number;
    collectionRate: number;   // paid / invoiced, 0..1 (of open invoices)
    overdueBalance: number;
    invoiceCount: number;
    tenantCount: number;
    buildingCount: number;
  };
  buildings: OsBuilding[];
  asOf: string;               // ISO yyyy-mm-dd
  rangeDays: number;
}

export async function getOutstandingBalances(params: {
  orgId: string; from: Date; to: Date; propertyId?: string;
}): Promise<OsReport> {
  const { orgId, to, propertyId } = params;
  const asOfMs = toDay(to);
  const asOfExclusive = new Date(asOfMs + DAY);

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["PENDING", "PARTIALLY_PAID", "PARTIAL", "DUE", "ISSUED"] },
      balanceDue: { gt: 0 },
      issueDate: { lt: asOfExclusive },
      ...(propertyId ? { propertyId } : {}),
    },
    select: {
      id: true, invoiceNumber: true, status: true, dueDate: true, issueDate: true,
      totalAmount: true, amountPaid: true, creditedAmount: true, balanceDue: true,
      propertyId: true, property: { select: { name: true } },
      tenantId: true, tenant: { select: { firstName: true, lastName: true } },
    },
  });

  type TAcc = { id: string; name: string; invoiced: number; paid: number; credited: number; balance: number; invoices: OsInvoice[] };
  type BAcc = { id: string; name: string; invoiced: number; paid: number; credited: number; balance: number; tenants: Map<string, TAcc> };
  const buildings = new Map<string, BAcc>();
  const ensureB = (pid: string, name: string): BAcc => {
    let b = buildings.get(pid);
    if (!b) { b = { id: pid, name, invoiced: 0, paid: 0, credited: 0, balance: 0, tenants: new Map() }; buildings.set(pid, b); }
    return b;
  };
  const ensureT = (b: BAcc, tid: string, name: string): TAcc => {
    let t = b.tenants.get(tid);
    if (!t) { t = { id: tid, name, invoiced: 0, paid: 0, credited: 0, balance: 0, invoices: [] }; b.tenants.set(tid, t); }
    return t;
  };
  const tenantIds = new Set<string>();

  for (const inv of invoices) {
    const balance = Number(inv.balanceDue);
    if (balance <= 0) continue;
    const invoiced = Number(inv.totalAmount);
    const paid = Number(inv.amountPaid);
    const credited = Number(inv.creditedAmount);
    const daysOverdue = Math.round((asOfMs - toDay(inv.dueDate)) / DAY);

    const pid = inv.propertyId ?? UNASSIGNED;
    const guest = inv.tenant ? `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "—" : "—";
    const b = ensureB(pid, inv.property?.name ?? "—");
    const t = ensureT(b, inv.tenantId, guest);

    for (const acc of [b, t]) {
      acc.invoiced = r3(acc.invoiced + invoiced);
      acc.paid = r3(acc.paid + paid);
      acc.credited = r3(acc.credited + credited);
      acc.balance = r3(acc.balance + balance);
    }
    t.invoices.push({
      id: inv.id, number: inv.invoiceNumber, status: inv.status,
      dueDate: inv.dueDate.toISOString(), issueDate: inv.issueDate.toISOString(), daysOverdue,
      invoiced: r3(invoiced), paid: r3(paid), credited: r3(credited), balance: r3(balance),
    });
    tenantIds.add(inv.tenantId);
  }

  const buildingsOut: OsBuilding[] = [...buildings.values()].map((b) => ({
    id: b.id, name: b.name, tenantCount: b.tenants.size,
    invoiced: b.invoiced, paid: b.paid, credited: b.credited, balance: b.balance,
    tenants: [...b.tenants.values()].map((t) => ({
      id: t.id, name: t.name, invoiced: t.invoiced, paid: t.paid, credited: t.credited, balance: t.balance,
      invoices: t.invoices.sort((a, c) => c.daysOverdue - a.daysOverdue || c.balance - a.balance),
    })).sort((a, c) => c.balance - a.balance),
  })).sort((a, c) => c.balance - a.balance);

  let invoiced = 0, paid = 0, credited = 0, balance = 0, overdueBalance = 0, invoiceCount = 0;
  for (const b of buildingsOut) {
    invoiced = r3(invoiced + b.invoiced); paid = r3(paid + b.paid); credited = r3(credited + b.credited); balance = r3(balance + b.balance);
    for (const t of b.tenants) for (const inv of t.invoices) { invoiceCount++; if (inv.daysOverdue > 0) overdueBalance = r3(overdueBalance + inv.balance); }
  }

  return {
    kpis: {
      balance, invoiced, paid, credited,
      collectionRate: invoiced > 0 ? r3(paid / invoiced) : 0,
      overdueBalance,
      invoiceCount,
      tenantCount: tenantIds.size,
      buildingCount: buildingsOut.length,
    },
    buildings: buildingsOut,
    asOf: new Date(asOfMs).toISOString().slice(0, 10),
    rangeDays: 1,
  };
}
