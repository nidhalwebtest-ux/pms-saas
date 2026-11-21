"use client";

import Link from "next/link";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import {
  Badge,
  defineColumns,
  getReturnStatusBadge,
  returnStatusKey,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format-currency";

/* ----------------------------------------------------------------------------
 *  Row shape — server → client table. Amounts are plain numbers, dates ISO.
 * ------------------------------------------------------------------------- */

export interface ReturnRow {
  id: string;
  returnNumber: string;
  status: string;            // "active" | "cancelled"
  refundStatus: string;      // NOT_REQUIRED | PENDING | COMPLETED
  returnType: string;        // DAILY | MONTHLY
  returnFrom: string;        // ISO
  returnTo: string;          // ISO
  returnDays: number;
  returnAmount: number;
  refundRequired: boolean;
  refundAmount: number;
  createdAt: string;         // ISO
  tenant: {
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
  reservation: {
    reservationNumber: string | null;
  };
  reservationId: string;
  invoice: { invoiceNumber: string | null } | null;
  invoiceId: string | null;
}

export function returnRowVariant(
  r: ReturnRow,
): "urgent" | "warning" | "inactive" | "default" {
  if (r.status === "cancelled") return "inactive";
  if (r.refundStatus === "PENDING") return "warning";
  return "default";
}

type T = (key: string, params?: Record<string, string | number | Date>) => string;

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

export interface ReturnColumnsDeps {
  /** `useTranslations("returns.table")` */
  tTbl: T;
  /** `useTranslations("returns.statuses")` */
  tStatus: T;
  /** `useTranslations("returns.types")` */
  tType: T;
  currency: string;
  locale: string;
}

export function buildReturnColumns({
  tTbl,
  tStatus,
  tType,
  currency,
  locale,
}: ReturnColumnsDeps) {
  const c = defineColumns<ReturnRow>();
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  const fmt = (iso: string, format = "d MMM yyyy") =>
    fmtDateFns(new Date(iso), format, { locale: dfLoc });

  return [
    /* ── Return # ──────────────────────────────────────────────────── */
    c.custom<string>({
      id: "returnNumber",
      header: tTbl("returnNumber"),
      accessorFn: (r) => r.returnNumber,
      enableSorting: false,
      meta: { mobile: "title" },
      cell: ({ row, getValue }) => (
        <Link
          href={`/dashboard/returns/${row.original.id}`}
          className="font-mono font-semibold text-brand-600 hover:underline ltr-numbers"
        >
          {getValue() as string}
        </Link>
      ),
    }),

    /* ── Status (refund) ───────────────────────────────────────────── */
    c.custom<string>({
      id: "status",
      header: tTbl("status"),
      accessorFn: (r) => r.refundStatus,
      enableSorting: false,
      meta: { mobile: "status" },
      cell: ({ row }) => {
        const key = returnStatusKey(row.original.status, row.original.refundStatus);
        return (
          <Badge {...getReturnStatusBadge(key)} size="sm">
            {tStatus(key)}
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
      cell: ({ row }) => (
        <Link
          href={`/dashboard/reservations/${row.original.reservationId}`}
          className="text-xs text-brand-600 hover:underline font-mono ltr-numbers"
        >
          {row.original.reservation.reservationNumber ?? tTbl("viewReservation")}
        </Link>
      ),
    }),

    /* ── Applied invoice ───────────────────────────────────────────── */
    c.custom<string | null>({
      id: "invoice",
      header: tTbl("invoice"),
      accessorFn: (r) => r.invoice?.invoiceNumber ?? null,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTbl("invoice") },
      cell: ({ row }) => {
        if (!row.original.invoiceId) return <span className="text-xs text-fg-tertiary">—</span>;
        return (
          <Link
            href={`/dashboard/invoices/${row.original.invoiceId}`}
            className="text-xs text-brand-600 hover:underline font-mono ltr-numbers"
          >
            {row.original.invoice?.invoiceNumber ?? tTbl("viewInvoice")}
          </Link>
        );
      },
    }),

    /* ── Type ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "returnType",
      header: tTbl("type"),
      accessorFn: (r) => r.returnType,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTbl("type") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-tertiary">
          {tType(row.original.returnType === "MONTHLY" ? "monthly" : "daily")}
        </span>
      ),
    }),

    /* ── Period ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "period",
      header: tTbl("period"),
      accessorFn: (r) => r.returnFrom,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 5, mobileLabel: tTbl("period") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-tertiary ltr-numbers">
          {fmt(row.original.returnFrom, "d MMM")} – {fmt(row.original.returnTo)}
        </span>
      ),
    }),

    /* ── Return amount ─────────────────────────────────────────────── */
    c.custom<number>({
      id: "returnAmount",
      header: tTbl("amount"),
      accessorFn: (r) => r.returnAmount,
      enableSorting: false,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 6, mobileLabel: tTbl("amount") },
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-fg tabular-nums" dir="ltr">
          {formatCurrency(row.original.returnAmount, currency)}
        </span>
      ),
    }),

    /* ── Refund ────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "refundAmount",
      header: tTbl("refund"),
      accessorFn: (r) => r.refundAmount,
      enableSorting: false,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 7, mobileLabel: tTbl("refund") },
      cell: ({ row }) => {
        if (!row.original.refundRequired) {
          return <span className="text-xs text-fg-tertiary">—</span>;
        }
        const cls = row.original.refundStatus === "PENDING"
          ? "text-warning-700 font-semibold"
          : "text-success-600 font-medium";
        return (
          <span className={`text-sm tabular-nums ${cls}`} dir="ltr">
            {formatCurrency(row.original.refundAmount, currency)}
          </span>
        );
      },
    }),

    /* ── Created ───────────────────────────────────────────────────── */
    c.custom<string>({
      id: "createdAt",
      header: tTbl("created"),
      accessorFn: (r) => r.createdAt,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 8, mobileLabel: tTbl("created") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-tertiary ltr-numbers">
          {fmt(row.original.createdAt)}
        </span>
      ),
    }),
  ];
}
