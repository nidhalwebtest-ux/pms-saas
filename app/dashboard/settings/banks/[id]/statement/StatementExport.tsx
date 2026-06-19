"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { DocumentArrowDownIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { downloadXlsx } from "@/lib/reports/export-xlsx";
import type { BankStatement } from "@/lib/bank-statement";

export default function StatementExport({
  bankId,
  from,
  to,
  statement,
}: {
  bankId: string;
  from: string;
  to: string;
  statement: BankStatement;
}) {
  const t = useTranslations("settings.banks.statement");
  const locale = useLocale();
  const dfLocale = locale === "ar" ? arLocale : enLocale;
  const [busy, setBusy] = useState(false);

  const typeLabel = (ty: string) => (t.has(`types.${ty}`) ? t(`types.${ty}`) : ty);
  const fmtD = (iso: string) => format(new Date(iso), "yyyy-MM-dd", { locale: dfLocale });

  function exportXlsx() {
    const header = [
      t("col.date"), t("col.type"), t("col.description"),
      t("col.reference"), t("col.in"), t("col.out"), t("col.balance"),
    ];
    const opening = [t("openingRow"), "", "", "", "", "", statement.openingBalance];
    const body = statement.rows.map((r) => [
      fmtD(r.date),
      typeLabel(r.type),
      r.description ?? "",
      r.reference ?? "",
      r.amount > 0 ? r.amount : "",
      r.amount < 0 ? Math.abs(r.amount) : "",
      r.balance,
    ]);
    const closing = [t("closing"), "", "", "", statement.totalIn, statement.totalOut, statement.closingBalance];
    const name = `${statement.account.bankName}-statement-${from}_${to}`.replace(/[^\w-]+/g, "_");
    downloadXlsx([header, opening, ...body, closing], name, "Statement");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportXlsx}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors"
      >
        <DocumentArrowDownIcon className="h-3.5 w-3.5" /> {t("exportXlsx")}
      </button>
      <a
        href={`/api/banks/${bankId}/statement/pdf?from=${from}&to=${to}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1500); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
      >
        <PrinterIcon className="h-3.5 w-3.5" /> {busy ? t("preparing") : t("exportPdf")}
      </a>
    </div>
  );
}
