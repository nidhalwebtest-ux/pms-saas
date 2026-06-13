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
