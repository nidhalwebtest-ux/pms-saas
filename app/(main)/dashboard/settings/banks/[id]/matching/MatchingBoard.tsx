"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ArrowsRightLeftIcon, DocumentArrowUpIcon, SparklesIcon,
  LinkIcon, XMarkIcon, TrashIcon, EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import type { MatchingView, MatchLine, MatchTxn } from "@/lib/bank-matching";
import {
  importStatementLines, runAutoMatch, matchPair, unmatchLine, setLineIgnored, deleteStatementLine,
} from "./actions";

/** Minimal CSV parser (handles quoted fields + commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export default function MatchingBoard({ bankId, currency, view, canEdit }: {
  bankId: string; currency: string; view: MatchingView; canEdit: boolean;
}) {
  const t = useTranslations("settings.banks.matching");
  const router = useRouter();
  const money = (n: number) => `${n.toFixed(3)} ${currency}`;

  const [busy, setBusy] = useState(false);
  const [selLine, setSelLine] = useState<string | null>(null);
  const [selTxn, setSelTxn] = useState<string | null>(null);

  // CSV import
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [map, setMap] = useState({ date: "", amount: "", description: "", reference: "" });

  async function run<T>(fn: () => Promise<{ ok?: boolean; error?: string; count?: number }>, okMsg?: (c?: number) => string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.error) { toast.error(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : res.error); return; }
    toast.success(okMsg ? okMsg(res.count) : t("done"));
    setSelLine(null); setSelTxn(null);
    router.refresh();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ""));
      if (rows.length < 2) { toast.error(t("errors.no_rows")); return; }
      const hdr = rows[0].map((h) => h.trim());
      setHeaders(hdr);
      setCsvRows(rows.slice(1));
      // Best-guess mapping.
      const find = (...names: string[]) => hdr.find((h) => names.some((n) => h.toLowerCase().includes(n))) ?? "";
      setMap({
        date: find("date", "تاريخ"),
        amount: find("amount", "value", "credit", "debit", "مبلغ"),
        description: find("desc", "narrat", "detail", "بيان", "وصف"),
        reference: find("ref", "cheque", "txn", "مرجع"),
      });
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!map.date || !map.amount) { toast.error(t("errors.map")); return; }
    const di = headers.indexOf(map.date), ai = headers.indexOf(map.amount);
    const desi = map.description ? headers.indexOf(map.description) : -1;
    const refi = map.reference ? headers.indexOf(map.reference) : -1;
    const lines = csvRows.map((r) => ({
      date: r[di]?.trim(),
      amount: Number((r[ai] ?? "").replace(/[^0-9.\-]/g, "")),
      description: desi >= 0 ? r[desi]?.trim() : undefined,
      reference: refi >= 0 ? r[refi]?.trim() : undefined,
    })).filter((l) => l.date && Number.isFinite(l.amount));
    if (lines.length === 0) { toast.error(t("errors.no_valid_rows")); return; }
    await run(() => importStatementLines(bankId, lines), (c) => t("imported", { count: c ?? 0 }));
    setHeaders([]); setCsvRows([]); setMap({ date: "", amount: "", description: "", reference: "" });
  }

  const s = view.summary;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label={t("matched")} value={String(s.matchedCount)} tone="green" />
        <Card label={t("unmatchedBank")} value={`${s.unmatchedBank} · ${money(s.unmatchedBankTotal)}`} />
        <Card label={t("unmatchedBook")} value={`${s.unmatchedBook} · ${money(s.unmatchedBookTotal)}`} />
        <Card label={t("difference")} value={money(s.difference)} tone={Math.abs(s.difference) < 0.001 ? "green" : "red"} />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
            <DocumentArrowUpIcon className="h-3.5 w-3.5" /> {t("uploadCsv")}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          <Button size="sm" variant="primary" onClick={() => run(() => runAutoMatch(bankId), (c) => t("autoMatched", { count: c ?? 0 }))} loading={busy} leftIcon={<SparklesIcon className="h-3.5 w-3.5" />}>
            {t("autoMatch")}
          </Button>
          {selLine && selTxn && (
            <Button size="sm" variant="secondary" onClick={() => run(() => matchPair(bankId, selLine, selTxn))} loading={busy} leftIcon={<LinkIcon className="h-3.5 w-3.5" />}>
              {t("matchSelected")}
            </Button>
          )}
        </div>
      )}

      {/* CSV mapping */}
      {headers.length > 0 && (
        <div className="rounded-xl bg-blue-50/50 p-4 ring-1 ring-blue-100">
          <p className="mb-3 text-sm font-semibold text-gray-900">{t("mapColumns", { rows: csvRows.length })}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["date", "amount", "description", "reference"] as const).map((f) => (
              <div key={f}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {t(`col.${f}`)}{(f === "date" || f === "amount") && <span className="text-red-500"> *</span>}
                </label>
                <select value={map[f]} onChange={(e) => setMap((m) => ({ ...m, [f]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                  <option value="">{t("none")}</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={doImport} loading={busy}>{t("import")}</Button>
            <button onClick={() => { setHeaders([]); setCsvRows([]); }} className="text-xs text-gray-500 hover:text-gray-700">{t("cancel")}</button>
          </div>
        </div>
      )}

      {/* Two-column board */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column title={t("bankSide")} subtitle={t("bankSideHint")}>
          {view.unmatchedLines.length === 0 ? <Empty text={t("allMatchedBank")} /> : view.unmatchedLines.map((l) => (
            <LineRow key={l.id} line={l} money={money} selected={selLine === l.id}
              onSelect={canEdit ? () => setSelLine(selLine === l.id ? null : l.id) : undefined}
              onIgnore={canEdit ? () => run(() => setLineIgnored(bankId, l.id, true)) : undefined}
              onDelete={canEdit ? () => run(() => deleteStatementLine(bankId, l.id)) : undefined}
              t={t} />
          ))}
        </Column>
        <Column title={t("bookSide")} subtitle={t("bookSideHint")}>
          {view.unmatchedTxns.length === 0 ? <Empty text={t("allMatchedBook")} /> : view.unmatchedTxns.map((tx) => (
            <TxnRow key={tx.id} txn={tx} money={money} selected={selTxn === tx.id}
              onSelect={canEdit ? () => setSelTxn(selTxn === tx.id ? null : tx.id) : undefined} t={t} />
          ))}
        </Column>
      </div>

      {/* Matched pairs */}
      {view.matched.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3"><h3 className="text-sm font-semibold text-gray-700">{t("matchedPairs")}</h3></div>
          <div className="divide-y divide-gray-50">
            {view.matched.map(({ line, txn }) => (
              <div key={line.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <ArrowsRightLeftIcon className="h-4 w-4 flex-shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900">{money(line.amount)}</span>
                  <span className="mx-2 text-gray-400">·</span>
                  <span className="text-gray-500 truncate">{txn.description || txn.type} ↔ {line.description || "—"}</span>
                </div>
                {canEdit && (
                  <button onClick={() => run(() => unmatchLine(bankId, line.id))} className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title={t("unmatch")}>
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const cls = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ltr-numbers ${cls}`}>{value}</p>
    </div>
  );
}
function Column({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <div className="max-h-[420px] divide-y divide-gray-50 overflow-y-auto">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-gray-400">{text}</p>;
}
function LineRow({ line, money, selected, onSelect, onIgnore, onDelete, t }: {
  line: MatchLine; money: (n: number) => string; selected: boolean;
  onSelect?: () => void; onIgnore?: () => void; onDelete?: () => void; t: (k: string) => string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${selected ? "bg-blue-50" : "hover:bg-gray-50/50"}`}>
      <button onClick={onSelect} disabled={!onSelect} className="min-w-0 flex-1 text-start">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ltr-numbers ${line.amount >= 0 ? "text-green-700" : "text-red-600"}`}>{money(line.amount)}</span>
          <span className="text-xs text-gray-400 ltr-numbers">{line.date.slice(0, 10)}</span>
        </div>
        <p className="truncate text-xs text-gray-500">{line.description || "—"}{line.reference ? ` · ${line.reference}` : ""}</p>
      </button>
      {onIgnore && <button onClick={onIgnore} className="rounded p-1 text-gray-300 hover:text-amber-600" title={t("ignore")}><EyeSlashIcon className="h-3.5 w-3.5" /></button>}
      {onDelete && <button onClick={onDelete} className="rounded p-1 text-gray-300 hover:text-red-600" title={t("delete")}><TrashIcon className="h-3.5 w-3.5" /></button>}
    </div>
  );
}
function TxnRow({ txn, money, selected, onSelect, t }: {
  txn: MatchTxn; money: (n: number) => string; selected: boolean; onSelect?: () => void; t: (k: string) => string;
}) {
  return (
    <button onClick={onSelect} disabled={!onSelect} className={`flex w-full items-center gap-3 px-4 py-2.5 text-start ${selected ? "bg-blue-50" : "hover:bg-gray-50/50"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ltr-numbers ${txn.amount >= 0 ? "text-green-700" : "text-red-600"}`}>{money(txn.amount)}</span>
          <span className="text-xs text-gray-400 ltr-numbers">{txn.date.slice(0, 10)}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{t(`types.${txn.type}`)}</span>
        </div>
        <p className="truncate text-xs text-gray-500">{txn.description || "—"}{txn.reference ? ` · ${txn.reference}` : ""}</p>
      </div>
    </button>
  );
}
