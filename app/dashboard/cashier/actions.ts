"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess, getSessionAccess } from "@/lib/access";
import { getSessionAccessibleProperties, canAccessProperty } from "@/lib/property-scope";
import { getCashierDaybook } from "@/lib/cashier-daybook";
import { getOrCreateCashDrawer } from "@/lib/cash-drawer";
import { postBankTxn } from "@/lib/bank-ledger";

export type ActionResponse = { ok?: boolean; error?: string; id?: string };

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

/**
 * Reconcile a building's cash drawer for a day and LOCK it. The day's closing
 * balance (from the daybook) is compared to the counted cash; any variance posts
 * an ADJUSTMENT ledger row dated to that day, re-anchoring the drawer to reality
 * so the variance never rolls forward. A locked day is frozen until a manager
 * unlocks it.
 */
export async function reconcileAndLock(fd: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!(await hasAccess("reconciliation", "CREATE"))) return { error: "forbidden" };

  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "no_org" };
  const orgId = access.organizationId;

  const propertyId = (fd.get("propertyId") as string)?.trim();
  if (!propertyId) return { error: "no_building" };

  const businessDate = new Date(fd.get("businessDate") as string);
  if (isNaN(businessDate.getTime())) return { error: "invalid_date" };
  if (startOfDay(businessDate) > startOfDay(new Date())) return { error: "future_date" };

  const countedCash = round3(parseFloat((fd.get("countedCash") as string) || "0"));
  if (!Number.isFinite(countedCash) || countedCash < 0) return { error: "invalid_counted" };

  const notes = (fd.get("notes") as string)?.trim() || null;

  // Building must belong to the org and be accessible to this user.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: orgId },
    select: { id: true },
  });
  if (!property) return { error: "invalid_building" };
  const accessible = await getSessionAccessibleProperties();
  if (!canAccessProperty(accessible, propertyId)) return { error: "forbidden" };

  const dayStart = startOfDay(businessDate);
  const dayEnd = endOfDay(businessDate);

  // Already locked for this building + day?
  const existing = await prisma.cashierSession.findFirst({
    where: { organizationId: orgId, propertyId, status: "LOCKED", businessDate: { gte: dayStart, lte: dayEnd } },
    select: { id: true },
  });
  if (existing) return { error: "already_locked" };

  // System closing = the daybook closing balance for that building/day.
  const daybook = await getCashierDaybook({ orgId, propertyId, date: businessDate });
  const opening = round3(daybook.openingBalance);
  const closing = round3(daybook.closingBalance);
  const variance = round3(countedCash - closing);

  const cashier = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, lastName: true },
  });
  const cashierName = `${cashier?.firstName ?? ""} ${cashier?.lastName ?? ""}`.trim() || null;

  try {
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.cashierSession.create({
        data: {
          organizationId: orgId,
          propertyId,
          cashierId: user.id,
          businessDate: dayStart,
          openingBalance: opening.toFixed(3),
          closingBalance: closing.toFixed(3),
          systemCash: closing.toFixed(3),
          countedCash: countedCash.toFixed(3),
          variance: variance.toFixed(3),
          status: "LOCKED",
          lockedAt: new Date(),
          lockedById: user.id,
          lockedByName: cashierName,
          notes,
        },
      });

      // Variance → ADJUSTMENT on the drawer, dated to the reconciled day, so the
      // closing equals the counted cash and carries forward correctly.
      if (Math.abs(variance) >= 0.001) {
        const drawer = await getOrCreateCashDrawer(tx, orgId, propertyId);
        if (drawer) {
          const adj = await postBankTxn(tx, {
            organizationId: orgId,
            bankAccountId: drawer.id,
            type: "ADJUSTMENT",
            amount: variance, // signed: + overage, − shortage
            date: dayEnd,
            description: `Reconciliation adjustment (${dayStart.toISOString().slice(0, 10)})`,
            cashierSessionId: created.id,
            createdById: user.id,
          });
          await tx.cashierSession.update({ where: { id: created.id }, data: { adjustmentTxnId: adj.id } });
        }
      }
      return created;
    });

    revalidatePath("/dashboard/cashier");
    return { ok: true, id: session.id };
  } catch (err) {
    console.error("[reconcileAndLock]", err);
    return { error: "generic" };
  }
}

/**
 * Manager-only unlock: reverse the day's reconciliation. Removes the variance
 * ADJUSTMENT (so the drawer balance returns to its pre-lock state) and deletes
 * the locked session so the day can be reconciled again.
 */
export async function unlockCashierSession(sessionId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!(await hasAccess("reconciliation", "FULL"))) return { error: "forbidden" };

  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "no_org" };
  const orgId = access.organizationId;

  const session = await prisma.cashierSession.findUnique({ where: { id: sessionId } });
  if (!session || session.organizationId !== orgId) return { error: "not_found" };
  if (session.status !== "LOCKED") return { error: "not_locked" };

  try {
    await prisma.$transaction(async (tx) => {
      if (session.adjustmentTxnId) {
        await tx.bankTransaction.deleteMany({ where: { id: session.adjustmentTxnId } });
      }
      await tx.cashierSession.delete({ where: { id: sessionId } });
    });
    revalidatePath("/dashboard/cashier");
    return { ok: true };
  } catch (err) {
    console.error("[unlockCashierSession]", err);
    return { error: "generic" };
  }
}
