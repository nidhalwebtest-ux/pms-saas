"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { can, type Role } from "@/lib/permissions";

export type Scope = "RECEPTIONIST" | "BUILDING" | "UNIT";
export type PeriodType = "WEEKLY" | "MONTHLY";

export interface SavedTarget {
  scope: Scope;
  refId: string;
  periodType: PeriodType;
  periodStart: string; // ISO yyyy-mm-dd
  amount: string;      // OMR, 3 decimals
}

export type SaveResult =
  | { ok: true; targets: SavedTarget[] }
  | { ok: false; error: string };

const SCOPES: Scope[] = ["RECEPTIONIST", "BUILDING", "UNIT"];
const PERIODS: PeriodType[] = ["WEEKLY", "MONTHLY"];

/** Normalize a picked date to the canonical period start (UTC). */
function normalizePeriodStart(periodType: PeriodType, iso: string): Date | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  if (periodType === "MONTHLY") return new Date(Date.UTC(y, m, 1));
  // WEEKLY → Monday of that week
  const dow = new Date(Date.UTC(y, m, day)).getUTCDay(); // 0=Sun..6=Sat
  const shift = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(y, m, day + shift));
}

/** Valid refIds for a scope within the org (so we never store foreign refs). */
async function validRefIds(scope: Scope, organizationId: string): Promise<Set<string>> {
  if (scope === "RECEPTIONIST") {
    const users = await prisma.user.findMany({ where: { organizationId }, select: { id: true } });
    return new Set(users.map((u) => u.id));
  }
  if (scope === "BUILDING") {
    const props = await prisma.property.findMany({ where: { organizationId }, select: { id: true } });
    return new Set(props.map((p) => p.id));
  }
  const units = await prisma.unit.findMany({
    where: { property: { organizationId } },
    select: { id: true },
  });
  return new Set(units.map((u) => u.id));
}

function periodEnd(periodType: PeriodType, start: Date): Date {
  if (periodType === "MONTHLY") return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return new Date(start.getTime() + 7 * 86_400_000);
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface PerfRow { refId: string; name: string; target: number; actual: number }
export type PerfResult =
  | { ok: true; rows: PerfRow[]; totalTarget: number; totalActual: number; periodStart: string }
  | { ok: false; error: string };

/** Target vs actual (net invoiced revenue) for a scope + period. */
export async function getTargetVsActual(input: {
  scope: Scope;
  periodType: PeriodType;
  periodStart: string;
}): Promise<PerfResult> {
  let actor;
  try {
    actor = await requireOrgUser();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!can(actor.role as Role, "manageSalesTargets")) return { ok: false, error: "forbidden" };

  const { scope, periodType } = input;
  if (!SCOPES.includes(scope) || !PERIODS.includes(periodType)) return { ok: false, error: "invalid_scope" };
  const start = normalizePeriodStart(periodType, input.periodStart);
  if (!start) return { ok: false, error: "invalid_period" };
  const end = periodEnd(periodType, start);
  const orgId = actor.organizationId;

  // Targets for this slice
  const targets = await prisma.salesTarget.findMany({
    where: { organizationId: orgId, scope, periodType, periodStart: start },
    select: { refId: true, amount: true },
  });
  const targetMap = new Map<string, number>(targets.map((t) => [t.refId, Number(t.amount)]));

  // Actuals = issued invoices (net of active returns) in the period, attributed per scope.
  const [invoices, returns] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: orgId, status: { notIn: ["DRAFT", "CANCELLED", "VOID"] }, issueDate: { gte: start, lt: end } },
      select: { propertyId: true, reservation: { select: { createdById: true } }, lineItems: { select: { unitId: true, lineTotal: true } } },
    }),
    prisma.return.findMany({
      where: { organizationId: orgId, status: "active", createdAt: { gte: start, lt: end } },
      select: { reservation: { select: { createdById: true } }, invoice: { select: { propertyId: true } }, lineItems: { select: { unitId: true, lineTotal: true } } },
    }),
  ]);

  const actual = new Map<string, number>();
  const add = (key: string | null | undefined, amt: number) => {
    if (!key) return;
    actual.set(key, r3((actual.get(key) ?? 0) + amt));
  };
  for (const inv of invoices) {
    const sum = inv.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0);
    if (scope === "RECEPTIONIST") add(inv.reservation?.createdById, sum);
    else if (scope === "BUILDING") add(inv.propertyId, sum);
    else for (const li of inv.lineItems) add(li.unitId, Number(li.lineTotal));
  }
  for (const ret of returns) {
    const sum = ret.lineItems.reduce((s, li) => s + Number(li.lineTotal), 0);
    if (scope === "RECEPTIONIST") add(ret.reservation?.createdById, -sum);
    else if (scope === "BUILDING") add(ret.invoice?.propertyId, -sum);
    else for (const li of ret.lineItems) add(li.unitId, -Number(li.lineTotal));
  }

  // Names for every refId that has a target or actual
  const refIds = new Set<string>([...targetMap.keys(), ...actual.keys()]);
  const nameMap = new Map<string, string>();
  if (scope === "RECEPTIONIST") {
    const users = await prisma.user.findMany({ where: { organizationId: orgId, id: { in: [...refIds] } }, select: { id: true, firstName: true, lastName: true, email: true } });
    for (const u of users) nameMap.set(u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);
  } else if (scope === "BUILDING") {
    const props = await prisma.property.findMany({ where: { organizationId: orgId, id: { in: [...refIds] } }, select: { id: true, name: true } });
    for (const p of props) nameMap.set(p.id, p.name);
  } else {
    const units = await prisma.unit.findMany({ where: { id: { in: [...refIds] }, property: { organizationId: orgId } }, select: { id: true, name: true } });
    for (const u of units) nameMap.set(u.id, u.name);
  }

  const rows: PerfRow[] = [...refIds]
    .map((refId) => ({ refId, name: nameMap.get(refId) ?? "—", target: r3(targetMap.get(refId) ?? 0), actual: r3(actual.get(refId) ?? 0) }))
    .filter((row) => row.target > 0 || row.actual > 0)
    .sort((a, b) => b.target - a.target || b.actual - a.actual);

  return {
    ok: true,
    rows,
    totalTarget: r3(rows.reduce((s, r) => s + r.target, 0)),
    totalActual: r3(rows.reduce((s, r) => s + r.actual, 0)),
    periodStart: start.toISOString().slice(0, 10),
  };
}

export async function saveSalesTargets(input: {
  scope: Scope;
  periodType: PeriodType;
  periodStart: string;
  entries: { refId: string; amount: string }[];
}): Promise<SaveResult> {
  let actor;
  try {
    actor = await requireOrgUser();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!can(actor.role as Role, "manageSalesTargets")) {
    return { ok: false, error: "forbidden" };
  }

  const { scope, periodType } = input;
  if (!SCOPES.includes(scope) || !PERIODS.includes(periodType)) {
    return { ok: false, error: "invalid_scope" };
  }
  const periodStart = normalizePeriodStart(periodType, input.periodStart);
  if (!periodStart) return { ok: false, error: "invalid_period" };

  const valid = await validRefIds(scope, actor.organizationId);
  const orgId = actor.organizationId;

  await prisma.$transaction(async (tx) => {
    for (const e of input.entries) {
      if (!valid.has(e.refId)) continue;
      const raw = (e.amount ?? "").trim();
      const num = Number(raw);
      const key = {
        organizationId_scope_refId_periodType_periodStart: {
          organizationId: orgId, scope, refId: e.refId, periodType, periodStart,
        },
      };
      // Empty / zero / invalid → remove any existing target for this cell.
      if (raw === "" || !isFinite(num) || num <= 0) {
        await tx.salesTarget.deleteMany({
          where: { organizationId: orgId, scope, refId: e.refId, periodType, periodStart },
        });
        continue;
      }
      await tx.salesTarget.upsert({
        where: key,
        create: { organizationId: orgId, scope, refId: e.refId, periodType, periodStart, amount: raw, createdById: actor.userId },
        update: { amount: raw },
      });
    }
  });

  const saved = await prisma.salesTarget.findMany({
    where: { organizationId: orgId, scope, periodType, periodStart },
    select: { scope: true, refId: true, periodType: true, periodStart: true, amount: true },
  });

  revalidatePath("/dashboard/sales-targets");

  return {
    ok: true,
    targets: saved.map((t) => ({
      scope: t.scope as Scope,
      refId: t.refId,
      periodType: t.periodType as PeriodType,
      periodStart: t.periodStart.toISOString().slice(0, 10),
      amount: t.amount.toString(),
    })),
  };
}
