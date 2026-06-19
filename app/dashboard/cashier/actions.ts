"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess, getSessionAccess } from "@/lib/access";
import { getCashierSummary } from "@/lib/cashier";
import { postBankTxn } from "@/lib/bank-ledger";

export type ActionResponse = { ok?: boolean; error?: string; id?: string };

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Record a daily cash reconciliation: snapshot expected vs counted cash, and
 * (optionally) deposit the cash into a bank account — posting a DEPOSIT_IN
 * ledger row so the deposit appears on that bank's statement.
 */
export async function createCashierReconciliation(fd: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  if (!(await hasAccess("reconciliation", "CREATE"))) return { error: "forbidden" };

  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "no_org" };
  const orgId = access.organizationId;

  const businessDate = new Date(fd.get("businessDate") as string);
  if (isNaN(businessDate.getTime())) return { error: "invalid_date" };

  const countedCash = round3(parseFloat((fd.get("countedCash") as string) || "0"));
  if (!Number.isFinite(countedCash) || countedCash < 0) return { error: "invalid_counted" };

  const depositBankAccountId = (fd.get("depositBankAccountId") as string)?.trim() || null;
  const depositedAmountRaw = (fd.get("depositedAmount") as string)?.trim();
  const depositedAmount = depositedAmountRaw ? round3(parseFloat(depositedAmountRaw)) : 0;
  const depositReference = (fd.get("depositReference") as string)?.trim() || null;
  const notes = (fd.get("notes") as string)?.trim() || null;

  const wantsDeposit = !!depositBankAccountId && depositedAmount > 0;
  if (wantsDeposit) {
    const bank = await prisma.bankAccount.findUnique({
      where: { id: depositBankAccountId! },
      select: { organizationId: true },
    });
    if (!bank || bank.organizationId !== orgId) return { error: "invalid_bank" };
  }

  // System cash = expected drawer cash for the day.
  const summary = await getCashierSummary({ orgId, date: businessDate });
  const systemCash = round3(summary.expectedCash);
  const variance = round3(countedCash - systemCash);

  try {
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.cashierSession.create({
        data: {
          organizationId: orgId,
          cashierId: user.id,
          businessDate,
          systemCash: systemCash.toFixed(3),
          countedCash: countedCash.toFixed(3),
          variance: variance.toFixed(3),
          status: wantsDeposit ? "DEPOSITED" : "RECONCILED",
          depositBankAccountId: wantsDeposit ? depositBankAccountId : null,
          depositedAmount: wantsDeposit ? depositedAmount.toFixed(3) : null,
          depositReference: wantsDeposit ? depositReference : null,
          depositedAt: wantsDeposit ? new Date() : null,
          notes,
        },
      });

      if (wantsDeposit) {
        await postBankTxn(tx, {
          organizationId: orgId,
          bankAccountId: depositBankAccountId!,
          type: "DEPOSIT_IN",
          amount: depositedAmount,
          date: new Date(),
          description: `Cash deposit (${businessDate.toISOString().slice(0, 10)})`,
          reference: depositReference,
          cashierSessionId: created.id,
          createdById: user.id,
        });
      }
      return created;
    });

    revalidatePath("/dashboard/cashier");
    return { ok: true, id: session.id };
  } catch (err) {
    console.error("[createCashierReconciliation]", err);
    return { error: "generic" };
  }
}
