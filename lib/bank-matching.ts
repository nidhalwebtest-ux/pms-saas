import { prisma } from "@/lib/prisma";

export interface MatchTxn {
  id: string; date: string; type: string; description: string | null; reference: string | null; amount: number;
}
export interface MatchLine {
  id: string; date: string; description: string | null; reference: string | null; amount: number; status: string;
}
export interface MatchingView {
  matched: { line: MatchLine; txn: MatchTxn }[];
  unmatchedLines: MatchLine[];
  unmatchedTxns: MatchTxn[];
  ignoredLines: MatchLine[];
  summary: {
    matchedCount: number;
    unmatchedBank: number; unmatchedBankTotal: number;
    unmatchedBook: number; unmatchedBookTotal: number;
    difference: number;
  };
}

const toTxn = (t: { id: string; date: Date; type: string; description: string | null; reference: string | null; amount: unknown }): MatchTxn =>
  ({ id: t.id, date: t.date.toISOString(), type: t.type, description: t.description, reference: t.reference, amount: Number(t.amount) });
const toLine = (l: { id: string; date: Date; description: string | null; reference: string | null; amount: unknown; status: string }): MatchLine =>
  ({ id: l.id, date: l.date.toISOString(), description: l.description, reference: l.reference, amount: Number(l.amount), status: l.status });

/** Full two-sided matching view for an account (book txns vs bank lines). */
export async function getMatchingView(orgId: string, bankAccountId: string): Promise<MatchingView | null> {
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { organizationId: true } });
  if (!account || account.organizationId !== orgId) return null;

  const [lines, txns] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where: { bankAccountId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.bankTransaction.findMany({
      where: { bankAccountId, isVoid: false },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const txnById = new Map(txns.map((t) => [t.id, t]));
  const matchedTxnIds = new Set(lines.filter((l) => l.matchedTxnId).map((l) => l.matchedTxnId!));

  const matched: { line: MatchLine; txn: MatchTxn }[] = [];
  const unmatchedLines: MatchLine[] = [];
  const ignoredLines: MatchLine[] = [];
  for (const l of lines) {
    if (l.matchedTxnId && txnById.has(l.matchedTxnId)) {
      matched.push({ line: toLine(l), txn: toTxn(txnById.get(l.matchedTxnId)!) });
    } else if (l.status === "IGNORED") {
      ignoredLines.push(toLine(l));
    } else {
      unmatchedLines.push(toLine(l));
    }
  }
  const unmatchedTxns = txns.filter((t) => !matchedTxnIds.has(t.id)).map(toTxn);

  const unmatchedBankTotal = unmatchedLines.reduce((s, l) => s + l.amount, 0);
  const unmatchedBookTotal = unmatchedTxns.reduce((s, t) => s + t.amount, 0);

  return {
    matched, unmatchedLines, unmatchedTxns, ignoredLines,
    summary: {
      matchedCount: matched.length,
      unmatchedBank: unmatchedLines.length, unmatchedBankTotal,
      unmatchedBook: unmatchedTxns.length, unmatchedBookTotal,
      difference: unmatchedBankTotal - unmatchedBookTotal,
    },
  };
}

const DAY = 86_400_000;

/**
 * Auto-match unmatched bank lines to unmatched book txns: equal signed amount,
 * date within ±dayTolerance, best by date proximity then reference overlap.
 * Returns the number of pairs matched.
 */
export async function autoMatch(orgId: string, bankAccountId: string, dayTolerance = 3): Promise<number> {
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { organizationId: true } });
  if (!account || account.organizationId !== orgId) return 0;

  const lines = await prisma.bankStatementLine.findMany({
    where: { bankAccountId, matchedTxnId: null, status: "UNMATCHED" },
    orderBy: { date: "asc" },
  });
  const txns = await prisma.bankTransaction.findMany({
    where: { bankAccountId, isVoid: false, matchedLine: null },
    orderBy: { date: "asc" },
  });

  const used = new Set<string>();
  const matches: { lineId: string; txnId: string }[] = [];

  for (const line of lines) {
    const lAmt = Number(line.amount).toFixed(3);
    const lTime = line.date.getTime();
    let best: { id: string; score: number } | null = null;
    for (const t of txns) {
      if (used.has(t.id)) continue;
      if (Number(t.amount).toFixed(3) !== lAmt) continue;
      const dayDiff = Math.abs(t.date.getTime() - lTime) / DAY;
      if (dayDiff > dayTolerance) continue;
      // Score: closer date better; reference overlap is a bonus.
      let score = dayTolerance - dayDiff;
      if (line.reference && t.reference && (t.reference.includes(line.reference) || line.reference.includes(t.reference))) score += 5;
      if (!best || score > best.score) best = { id: t.id, score };
    }
    if (best) { used.add(best.id); matches.push({ lineId: line.id, txnId: best.id }); }
  }

  if (matches.length === 0) return 0;
  await prisma.$transaction(
    matches.map((m) =>
      prisma.bankStatementLine.update({ where: { id: m.lineId }, data: { matchedTxnId: m.txnId, status: "MATCHED" } }),
    ),
  );
  return matches.length;
}
