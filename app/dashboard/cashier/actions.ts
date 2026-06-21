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
 * Deposit cash from a building's drawer into a bank account — a dependent
 * two-leg transaction: TRANSFER_OUT of the drawer + DEPOSIT_IN to the bank,
 * linked by a shared transferGroupId. The drawer balance drops and the deposit
 * appears on the bank statement.
 */
export async function createCashDeposit(fd: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!(await hasAccess("reconciliation", "CREATE"))) return { error: "forbidden" };

  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "no_org" };
  const orgId = access.organizationId;

  const propertyId = (fd.get("propertyId") as string)?.trim();
  if (!propertyId) return { error: "no_building" };

  const bankAccountId = (fd.get("bankAccountId") as string)?.trim();
  if (!bankAccountId) return { error: "bank" };

  const amount = round3(parseFloat((fd.get("amount") as string) || "0"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount" };

  const reference = (fd.get("reference") as string)?.trim() || null;

  // Building must belong to the org and be accessible.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!property) return { error: "invalid_building" };
  const accessible = await getSessionAccessibleProperties();
  if (!canAccessProperty(accessible, propertyId)) return { error: "forbidden" };

  // Target bank must be a real, active bank account in the org.
  const bank = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId: orgId, type: "BANK", isActive: true },
    select: { id: true, bankName: true },
  });
  if (!bank) return { error: "invalid_bank" };

  const now = new Date();

  // Don't mutate a locked day (the deposit posts today).
  const lockedToday = await prisma.cashierSession.findFirst({
    where: { organizationId: orgId, propertyId, status: "LOCKED", businessDate: { gte: startOfDay(now), lte: endOfDay(now) } },
    select: { id: true },
  });
  if (lockedToday) return { error: "day_locked" };

  try {
    const groupId = crypto.randomUUID();
    await prisma.$transaction(async (tx) => {
      const drawer = await getOrCreateCashDrawer(tx, orgId, propertyId);
      if (!drawer) throw new Error("no_drawer");

      // Can't deposit more than the drawer holds.
      const agg = await tx.bankTransaction.aggregate({
        where: { bankAccountId: drawer.id, isVoid: false },
        _sum: { amount: true },
      });
      const balance = round3(Number(drawer.openingBalance) + Number(agg._sum.amount ?? 0));
      if (amount > balance + 0.0005) throw new Error("insufficient_cash");

      await postBankTxn(tx, {
        organizationId: orgId,
        bankAccountId: drawer.id,
        type: "TRANSFER_OUT",
        amount,
        date: now,
        description: `Deposit to ${bank.bankName}`,
        reference,
        transferGroupId: groupId,
        createdById: user.id,
      });
      await postBankTxn(tx, {
        organizationId: orgId,
        bankAccountId: bank.id,
        type: "DEPOSIT_IN",
        amount,
        date: now,
        description: `Cash deposit — ${property.name}`,
        reference,
        transferGroupId: groupId,
        createdById: user.id,
      });
    });

    revalidatePath("/dashboard/cashier");
    return { ok: true };
  } catch (err: any) {
    if (err?.message === "insufficient_cash") return { error: "insufficient_cash" };
    if (err?.message === "no_drawer") return { error: "no_drawer" };
    console.error("[createCashDeposit]", err);
    return { error: "generic" };
  }
}

/**
 * Manager-only: remove a cash deposit (both legs). Blocked if the drawer leg
 * falls on a locked day.
 */
export async function deleteCashDeposit(transferGroupId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!(await hasAccess("reconciliation", "FULL"))) return { error: "forbidden" };

  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "no_org" };
  const orgId = access.organizationId;

  const legs = await prisma.bankTransaction.findMany({
    where: { transferGroupId, organizationId: orgId },
    include: { bankAccount: { select: { type: true, propertyId: true } } },
  });
  if (legs.length === 0) return { error: "not_found" };

  // If the drawer leg's day is locked for its building, block.
  const drawerLeg = legs.find((l) => l.bankAccount.type === "CASH");
  if (drawerLeg?.bankAccount.propertyId) {
    const locked = await prisma.cashierSession.findFirst({
      where: {
        organizationId: orgId,
        propertyId: drawerLeg.bankAccount.propertyId,
        status: "LOCKED",
        businessDate: { gte: startOfDay(drawerLeg.date), lte: endOfDay(drawerLeg.date) },
      },
      select: { id: true },
    });
    if (locked) return { error: "day_locked" };
  }

  try {
    await prisma.bankTransaction.deleteMany({ where: { transferGroupId, organizationId: orgId } });
    revalidatePath("/dashboard/cashier");
    return { ok: true };
  } catch (err) {
    console.error("[deleteCashDeposit]", err);
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
