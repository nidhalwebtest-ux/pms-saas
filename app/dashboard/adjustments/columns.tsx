"use client";

import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { useLocale } from "next-intl";
import { defineColumns } from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";

export interface AdjustmentRow {
  id: string;
  date: string;        // ISO
  propertyId: string | null;
  building: string;
  amount: number;      // signed: + overage, − shortage
  description: string | null;
  by: string | null;
}

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export function buildAdjustmentColumns({ tTbl, currency }: { tTbl: T; currency: string }) {
  const c = defineColumns<AdjustmentRow>();

  return [
    c.custom<string>({
      id: "date",
      header: tTbl("date"),
      accessorFn: (r) => r.date,
      sortingFn: (a, b) => new Date(a.original.date).getTime() - new Date(b.original.date).getTime(),
      meta: { mobile: "title" },
      cell: ({ row }) => <DateText iso={row.original.date} />,
    }),
    c.custom<string>({
      id: "building",
      header: tTbl("building"),
      accessorFn: (r) => r.building,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTbl("building") },
      cell: ({ row }) => <span className="text-sm text-fg-secondary">{row.original.building}</span>,
    }),
    c.custom<number>({
      id: "amount",
      header: tTbl("amount"),
      accessorFn: (r) => r.amount,
      sortingFn: (a, b) => a.original.amount - b.original.amount,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 1, mobileLabel: tTbl("amount") },
      cell: ({ row }) => {
        const v = row.original.amount;
        const cls = Math.abs(v) < 0.001 ? "text-fg-tertiary" : v > 0 ? "text-success-700" : "text-danger-600";
        return (
          <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${cls}`} dir="ltr">
            {v > 0 ? "+" : ""}{formatAmount(v, currency)}
          </span>
        );
      },
    }),
    c.custom<string>({
      id: "kind",
      header: tTbl("kind"),
      accessorFn: (r) => (r.amount > 0 ? "over" : r.amount < 0 ? "short" : "none"),
      enableSorting: false,
      meta: { mobile: "status" },
      cell: ({ row, getValue }) => {
        const k = getValue() as string;
        if (k === "none") return <span className="text-sm text-fg-tertiary">—</span>;
        const over = k === "over";
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${over ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {over ? tTbl("overage") : tTbl("shortage")}
          </span>
        );
      },
    }),
    c.custom<string | null>({
      id: "by",
      header: tTbl("by"),
      accessorFn: (r) => r.by,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTbl("by") },
      cell: ({ row }) => <span className="text-sm text-fg-tertiary whitespace-nowrap">{row.original.by || "—"}</span>,
    }),
  ];
}

function DateText({ iso }: { iso: string }) {
  const locale = useLocale();
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  return (
    <span className="text-sm text-fg-tertiary ltr-numbers whitespace-nowrap">
      {fmtDateFns(new Date(iso), "d MMM yyyy", { locale: dfLoc })}
    </span>
  );
}
