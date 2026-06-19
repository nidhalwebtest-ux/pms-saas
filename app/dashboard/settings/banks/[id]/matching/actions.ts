"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionAccess, hasAccess } from "@/lib/access";
import { autoMatch } from "@/lib/bank-matching";

export type ActionResult = { ok?: boolean; error?: string; count?: number };

async function guard(bankAccountId: string): Promise<{ orgId: string } | { error: string }> {
  const access = await getSessionAccess();
  if (!access?.organizationId) return { error: "unauthorized" };
  if (!(await hasAccess("banks", "EDIT"))) return { error: "forbidden" };
  const bank = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { organizationId: true } });
  if (!bank || bank.organizationId !== access.organizationId) return { error: "not_found" };
  return { orgId: access.organizationId };
}

function refresh(bankAccountId: string) {
  revalidatePath(`/dashboard/settings/banks/${bankAccountId}/matching`);
}

/** Import statement lines (from CSV mapping or manual entry). */
export async function importStatementLines(
  bankAccountId: string,
  lines: { date: string; amount: number; description?: string; reference?: string }[],
): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  if (!Array.isArray(lines) || lines.length === 0) return { error: "no_rows" };

  const batchId = randomUUID();
  const data = [];
  for (const l of lines) {
    const d = new Date(l.date);
    const amt = Number(l.amount);
    if (isNaN(d.getTime()) || !Number.isFinite(amt)) continue;
    data.push({
      organizationId: g.orgId,
      bankAccountId,
      date: d,
      amount: amt.toFixed(3),
      description: l.description?.trim() || null,
      reference: l.reference?.trim() || null,
      importBatchId: batchId,
    });
  }
  if (data.length === 0) return { error: "no_valid_rows" };
  await prisma.bankStatementLine.createMany({ data });
  refresh(bankAccountId);
  return { ok: true, count: data.length };
}

/** Run the auto-matcher. */
export async function runAutoMatch(bankAccountId: string): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  const count = await autoMatch(g.orgId, bankAccountId);
  refresh(bankAccountId);
  return { ok: true, count };
}

/** Manually match a bank line to a book transaction. */
export async function matchPair(bankAccountId: string, lineId: string, txnId: string): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  const [line, txn] = await Promise.all([
    prisma.bankStatementLine.findUnique({ where: { id: lineId }, select: { bankAccountId: true, matchedTxnId: true } }),
    prisma.bankTransaction.findUnique({ where: { id: txnId }, select: { bankAccountId: true, matchedLine: { select: { id: true } } } }),
  ]);
  if (!line || line.bankAccountId !== bankAccountId) return { error: "not_found" };
  if (!txn || txn.bankAccountId !== bankAccountId) return { error: "not_found" };
  if (line.matchedTxnId || txn.matchedLine) return { error: "already_matched" };

  await prisma.bankStatementLine.update({ where: { id: lineId }, data: { matchedTxnId: txnId, status: "MATCHED" } });
  refresh(bankAccountId);
  return { ok: true };
}

/** Undo a match. */
export async function unmatchLine(bankAccountId: string, lineId: string): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId }, select: { bankAccountId: true } });
  if (!line || line.bankAccountId !== bankAccountId) return { error: "not_found" };
  await prisma.bankStatementLine.update({ where: { id: lineId }, data: { matchedTxnId: null, status: "UNMATCHED" } });
  refresh(bankAccountId);
  return { ok: true };
}

/** Mark / unmark a line as ignored (not relevant to matching). */
export async function setLineIgnored(bankAccountId: string, lineId: string, ignored: boolean): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId }, select: { bankAccountId: true, matchedTxnId: true } });
  if (!line || line.bankAccountId !== bankAccountId) return { error: "not_found" };
  if (line.matchedTxnId) return { error: "already_matched" };
  await prisma.bankStatementLine.update({ where: { id: lineId }, data: { status: ignored ? "IGNORED" : "UNMATCHED" } });
  refresh(bankAccountId);
  return { ok: true };
}

/** Delete an imported line (only when not matched). */
export async function deleteStatementLine(bankAccountId: string, lineId: string): Promise<ActionResult> {
  const g = await guard(bankAccountId);
  if ("error" in g) return g;
  const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId }, select: { bankAccountId: true, matchedTxnId: true } });
  if (!line || line.bankAccountId !== bankAccountId) return { error: "not_found" };
  if (line.matchedTxnId) return { error: "already_matched" };
  await prisma.bankStatementLine.delete({ where: { id: lineId } });
  refresh(bankAccountId);
  return { ok: true };
}
