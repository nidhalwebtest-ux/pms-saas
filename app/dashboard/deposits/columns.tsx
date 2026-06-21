"use client";

import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { useLocale } from "next-intl";
import { defineColumns } from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";

export interface DepositRow {
  groupId: string;
  date: string;        // ISO
  building: string;
  bank: string;
  amount: number;
  reference: string | null;
}

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export function buildDepositColumns({ tTbl, currency }: { tTbl: T; currency: string }) {
  const c = defineColumns<DepositRow>();

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
    c.custom<string>({
      id: "bank",
      header: tTbl("bank"),
      accessorFn: (r) => r.bank,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTbl("bank") },
      cell: ({ row }) => <span className="text-sm font-medium text-fg">{row.original.bank}</span>,
    }),
    c.custom<number>({
      id: "amount",
      header: tTbl("amount"),
      accessorFn: (r) => r.amount,
      sortingFn: (a, b) => a.original.amount - b.original.amount,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 1, mobileLabel: tTbl("amount") },
      cell: ({ row }) => (
        <span className="text-sm font-bold text-fg tabular-nums whitespace-nowrap" dir="ltr">
          {formatAmount(row.original.amount, currency)}
        </span>
      ),
    }),
    c.custom<string | null>({
      id: "reference",
      header: tTbl("reference"),
      accessorFn: (r) => r.reference,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTbl("reference") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary whitespace-nowrap ltr-numbers">{row.original.reference || "—"}</span>
      ),
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
