"use client";

import Link from "next/link";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { useLocale } from "next-intl";
import {
  Badge,
  defineColumns,
  getPaymentMethodBadge,
  type PaymentMethodKey,
} from "@/components/ui";
import { formatAmount } from "@/lib/format-currency";

/* ----------------------------------------------------------------------------
 *  Row shape — serialized payment for the client table.
 *  Decimal → number, Date → ISO string, allocations pre-joined.
 * ------------------------------------------------------------------------- */

export interface PaymentRow {
  id: string;
  paymentNumber: string | null;
  /** ISO. */
  date: string;
  amount: number;
  method: string;
  reference: string | null;
  tenant: { id: string; firstName: string | null; lastName: string | null };
  receivedBy: { firstName: string | null; lastName: string | null } | null;
  /** Comma-separated invoice numbers, or empty for unapplied payments. */
  appliedTo: string;
}

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface PaymentColumnsDeps {
  /** `useTranslations("payments.list")` */
  tList: T;
  /** `useTranslations("payments.table")` */
  tTbl: T;
  /** `useTranslations("payments.methods")` */
  tMethod: T;
  /** Org currency code. */
  currency: string;
}

export function buildPaymentColumns({
  tList,
  tTbl,
  tMethod,
  currency,
}: PaymentColumnsDeps) {
  const c = defineColumns<PaymentRow>();

  return [
    /* ── Receipt # ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "paymentNumber",
      header: tTbl("receiptNumber"),
      accessorFn: (r) => r.paymentNumber ?? r.id.slice(0, 8).toUpperCase(),
      enableSorting: false,
      meta: { mobile: "title" },
      cell: ({ row, getValue }) => (
        <Link
          href={`/dashboard/payments/${row.original.id}`}
          className="font-mono text-sm font-semibold text-brand-600 hover:underline ltr-numbers"
        >
          {getValue() as string}
        </Link>
      ),
    }),

    /* ── Date ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "date",
      header: tTbl("date"),
      accessorFn: (r) => r.date,
      sortingFn: (a, b) =>
        new Date(a.original.date).getTime() -
        new Date(b.original.date).getTime(),
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTbl("date") },
      cell: ({ row }) => <DateText iso={row.original.date} />,
    }),

    /* ── Tenant ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "tenant",
      header: tTbl("tenant"),
      accessorFn: (r) =>
        `${r.tenant.firstName ?? ""} ${r.tenant.lastName ?? ""}`.trim(),
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTbl("tenant") },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/tenants/${row.original.tenant.id}`}
          className="text-sm font-medium text-brand-600 hover:underline truncate"
        >
          {row.original.tenant.firstName} {row.original.tenant.lastName}
        </Link>
      ),
    }),

    /* ── Amount ────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "amount",
      header: tTbl("amount"),
      accessorFn: (r) => r.amount,
      sortingFn: (a, b) => a.original.amount - b.original.amount,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 1, mobileLabel: tTbl("amount") },
      cell: ({ row }) => (
        <span className="text-sm font-bold text-success-700 tabular-nums whitespace-nowrap" dir="ltr">
          {formatAmount(row.original.amount, currency)}
        </span>
      ),
    }),

    /* ── Method ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "method",
      header: tTbl("method"),
      accessorFn: (r) => r.method,
      sortingFn: "alphanumeric",
      meta: { mobile: "status" },
      cell: ({ row }) => (
        <Badge
          {...getPaymentMethodBadge(row.original.method as PaymentMethodKey)}
          size="sm"
        >
          {safeMethod(row.original.method, tMethod)}
        </Badge>
      ),
    }),

    /* ── Reference ─────────────────────────────────────────────────── */
    c.custom<string | null>({
      id: "reference",
      header: tTbl("reference"),
      accessorFn: (r) => r.reference,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 5, mobileLabel: tTbl("reference") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-tertiary whitespace-nowrap">
          {row.original.reference || "—"}
        </span>
      ),
    }),

    /* ── Applied to ────────────────────────────────────────────────── */
    c.custom<string>({
      id: "appliedTo",
      header: tTbl("appliedTo"),
      accessorFn: (r) => r.appliedTo,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTbl("appliedTo") },
      cell: ({ row }) =>
        row.original.appliedTo ? (
          <span className="text-sm text-fg-tertiary ltr-numbers max-w-[180px] truncate block">
            {row.original.appliedTo}
          </span>
        ) : (
          <span className="text-sm italic text-fg-tertiary">
            {tList("unapplied")}
          </span>
        ),
    }),

    /* ── Received by ───────────────────────────────────────────────── */
    c.custom<string>({
      id: "receivedBy",
      header: tTbl("receivedBy"),
      accessorFn: (r) =>
        r.receivedBy
          ? `${r.receivedBy.firstName ?? ""} ${r.receivedBy.lastName ?? ""}`.trim()
          : "",
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 6, mobileLabel: tTbl("receivedBy") },
      cell: ({ row }) => {
        const r = row.original.receivedBy;
        if (!r) return <span className="text-sm text-fg-tertiary">—</span>;
        return (
          <span className="text-sm text-fg-tertiary whitespace-nowrap">
            {r.firstName} {r.lastName}
          </span>
        );
      },
    }),
  ];
}

function safeMethod(method: string, t: T) {
  try {
    return t(method);
  } catch {
    return method;
  }
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
