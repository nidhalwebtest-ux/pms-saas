"use client";

import Link from "next/link";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  Badge,
  defineColumns,
  resolveInvoiceBadge,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format-currency";

/* ----------------------------------------------------------------------------
 *  Row shape — what the server passes into the client table.
 *  All amounts are plain numbers (Decimal → number on the server) and all
 *  dates are ISO strings so the server/client boundary serializes cleanly.
 * ------------------------------------------------------------------------- */

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  /** ISO. */
  dueDate: string;
  /** ISO. */
  issueDate: string;
  /** ISO. */
  periodStart: string;
  /** ISO. */
  periodEnd: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  tenant: {
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
  reservation: {
    reservationNumber: string | null;
  };
  reservationId: string;
}

/* ----------------------------------------------------------------------------
 *  Helpers
 * ------------------------------------------------------------------------- */

function isOverdue(status: string, dueDateIso: string): boolean {
  const OUTSTANDING = ["ISSUED", "PENDING", "PARTIALLY_PAID"];
  if (!OUTSTANDING.includes(status)) return false;
  // Day-level compare: an invoice due *today* is not overdue yet.
  const due = new Date(dueDateIso);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const now = new Date();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay < todayDay;
}

export function invoiceRowVariant(
  r: InvoiceRow,
): "urgent" | "warning" | "inactive" | "default" {
  if (isOverdue(r.status, r.dueDate)) return "urgent";
  if (r.status === "DRAFT") return "warning";
  if (r.status === "CANCELLED") return "inactive";
  return "default";
}

type T = (key: string, params?: Record<string, string | number | Date>) => string;

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

export interface InvoiceColumnsDeps {
  /** `useTranslations("invoices.table")` */
  tTbl: T;
  /** `useTranslations("invoices.statuses")` */
  tStatus: T;
  /** Org currency code (`"OMR"`, `"USD"`, etc.). */
  currency: string;
  /** next-intl locale (`"en"` / `"ar"`). */
  locale: string;
}

export function buildInvoiceColumns({
  tTbl,
  tStatus,
  currency,
  locale,
}: InvoiceColumnsDeps) {
  const c = defineColumns<InvoiceRow>();
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  const fmt = (iso: string, format = "d MMM yyyy") =>
    fmtDateFns(new Date(iso), format, { locale: dfLoc });

  return [
    /* ── Invoice # ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "invoiceNumber",
      header: tTbl("invoiceNumber"),
      accessorFn: (r) => r.invoiceNumber,
      enableSorting: false,
      meta: { mobile: "title" },
      cell: ({ row, getValue }) => (
        <Link
          href={`/dashboard/invoices/${row.original.id}`}
          className="font-mono font-semibold text-brand-600 hover:underline ltr-numbers"
        >
          {getValue() as string}
        </Link>
      ),
    }),

    /* ── Status ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "status",
      header: tTbl("status"),
      accessorFn: (r) => r.status,
      enableSorting: false,
      meta: { mobile: "status" },
      cell: ({ row }) => {
        const { props, key } = resolveInvoiceBadge(
          row.original.status,
          new Date(row.original.dueDate),
        );
        const labelKey =
          key === "overdue" ? "overdue" :
          key === "draft" ? "draft" :
          key === "pending" ? (row.original.status === "PENDING" ? "pending" : "issued") :
          key === "partially-paid" ? "partial" :
          key === "paid" ? "paid" :
          key === "returned" ? "returned" :
                              "cancelled";
        return (
          <Badge {...props} size="sm">
            {tStatus(labelKey)}
          </Badge>
        );
      },
    }),

    /* ── Tenant ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "tenant",
      header: tTbl("tenant"),
      accessorFn: (r) => `${r.tenant.firstName ?? ""} ${r.tenant.lastName ?? ""}`.trim(),
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 1 },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium text-fg truncate">
            {row.original.tenant.firstName} {row.original.tenant.lastName}
          </div>
          <div className="text-xs text-fg-tertiary ltr-numbers truncate">
            {row.original.tenant.phone}
          </div>
        </div>
      ),
    }),

    /* ── Reservation ───────────────────────────────────────────────── */
    c.custom<string | null>({
      id: "reservation",
      header: tTbl("reservation"),
      accessorFn: (r) => r.reservation.reservationNumber,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTbl("reservation") },
      cell: ({ row }) => {
        const num = row.original.reservation.reservationNumber;
        return (
          <Link
            href={`/dashboard/reservations/${row.original.reservationId}`}
            className="text-xs text-brand-600 hover:underline font-mono ltr-numbers"
          >
            {num ?? tTbl("viewReservation")}
          </Link>
        );
      },
    }),

    /* ── Period ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "period",
      header: tTbl("period"),
      accessorFn: (r) => r.periodStart,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTbl("period") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-tertiary ltr-numbers">
          {fmt(row.original.periodStart, "d MMM")} – {fmt(row.original.periodEnd)}
        </span>
      ),
    }),

    /* ── Issue date ────────────────────────────────────────────────── */
    c.custom<string>({
      id: "issueDate",
      header: tTbl("issueDate"),
      accessorFn: (r) => r.issueDate,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTbl("issueDate") },
      cell: ({ row }) => {
        if (row.original.status === "DRAFT") {
          return (
            <span className="text-xs italic text-warning-700">
              {tTbl("notIssued")}
            </span>
          );
        }
        return (
          <span className="text-xs text-fg-tertiary ltr-numbers">
            {fmt(row.original.issueDate)}
          </span>
        );
      },
    }),

    /* ── Total ─────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "totalAmount",
      header: tTbl("total"),
      accessorFn: (r) => r.totalAmount,
      enableSorting: false,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 5, mobileLabel: tTbl("total") },
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-fg tabular-nums" dir="ltr">
          {formatCurrency(row.original.totalAmount, currency)}
        </span>
      ),
    }),

    /* ── Paid ──────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "amountPaid",
      header: tTbl("paid"),
      accessorFn: (r) => r.amountPaid,
      enableSorting: false,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 6, mobileLabel: tTbl("paid") },
      cell: ({ row }) => (
        <span className="text-sm text-success-600 font-medium tabular-nums" dir="ltr">
          {formatCurrency(row.original.amountPaid, currency)}
        </span>
      ),
    }),

    /* ── Balance ───────────────────────────────────────────────────── */
    c.custom<number>({
      id: "balanceDue",
      header: tTbl("balance"),
      accessorFn: (r) => r.balanceDue,
      enableSorting: false,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 7, mobileLabel: tTbl("balance") },
      cell: ({ row }) => {
        const b = row.original.balanceDue;
        const cls = b > 0 ? "text-error-600 font-semibold" : "text-fg-tertiary";
        return (
          <span className={`text-sm tabular-nums ${cls}`} dir="ltr">
            {formatCurrency(b, currency)}
          </span>
        );
      },
    }),

    /* ── Due date ──────────────────────────────────────────────────── */
    c.custom<string>({
      id: "dueDate",
      header: tTbl("dueDate"),
      accessorFn: (r) => r.dueDate,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 8, mobileLabel: tTbl("dueDate") },
      cell: ({ row }) => {
        const overdue = isOverdue(row.original.status, row.original.dueDate);
        const cls = overdue ? "text-error-600 font-semibold" : "text-fg-tertiary";
        return (
          <span className={`text-xs ltr-numbers ${cls}`}>
            {fmt(row.original.dueDate)}
          </span>
        );
      },
    }),
  ];
}
