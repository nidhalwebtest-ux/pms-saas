"use client";

import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { ColumnDef } from "@tanstack/react-table";
import type { DisplayStatus } from "@/lib/reservation-status";
import {
  Badge,
  defineColumns,
  getReservationStatusBadge,
  reservationStatusKeyFromDisplayLabel,
} from "@/components/ui";
import type { ReservationRow } from "./ReservationsView";

/* ----------------------------------------------------------------------------
 *  Helpers — local to this column file
 * ------------------------------------------------------------------------- */

export function countryFlag(nationality: string | null): string {
  if (!nationality) return "";
  const code = nationality.trim().toUpperCase().slice(0, 2);
  if (code.length !== 2) return "";
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const DISPLAY_STATUS_I18N: Partial<Record<DisplayStatus, string>> = {
  Upcoming: "upcoming",
  "Arriving Today": "arrivingToday",
  "Overdue Arrival": "overdueArrival",
  "In House": "inHouse",
  "Due Checkout": "dueCheckout",
  Overstay: "overstay",
  "Checked Out": "checkedOut",
  Cancelled: "cancelled",
  "No Show": "noShow",
};

function translateDisplayStatus(
  ds: DisplayStatus,
  tStatus: (key: string) => string,
): string {
  const key = DISPLAY_STATUS_I18N[ds];
  return key ? tStatus(key) : ds;
}

function toLocalDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/* ----------------------------------------------------------------------------
 *  Row-variant resolver — drives per-row tint via DataTable's rowVariant prop
 * ------------------------------------------------------------------------- */

export function reservationRowVariant(
  r: ReservationRow,
): "urgent" | "inactive" | "pinned" | "default" {
  if (r.displayStatus === "Overstay" || r.displayStatus === "Overdue Arrival") {
    return "urgent";
  }
  if (
    r.displayStatus === "Cancelled" ||
    r.displayStatus === "No Show" ||
    r.displayStatus === "Checked Out"
  ) {
    return "inactive";
  }
  if (r.tenant.classification === "vip") return "pinned";
  return "default";
}

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

/** Loose translator shape compatible with next-intl's `useTranslations` return value. */
type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface ReservationColumnsDeps {
  /** `useTranslations("reservations")` */
  t: T;
  /** `useTranslations("reservations.table")` */
  tTable: T;
  /** `useTranslations("reservations.statuses")` */
  tStatus: T;
  /** Returned by `useFmtDate()` — `(iso) => { text, cls }`. */
  fmtDate: (iso: string) => { text: string; cls: string };
  /** Returned by `useFmtDuration()` — `(row) => string`. */
  fmtDuration: (row: ReservationRow) => string;
}

export function buildReservationColumns({
  t,
  tTable,
  tStatus,
  fmtDate,
  fmtDuration,
}: ReservationColumnsDeps): ColumnDef<ReservationRow, any>[] {
  const c = defineColumns<ReservationRow>();
  // Computed at render so the urgency tone reflects the *current* day, not
  // module load. Cheap enough to recompute per row render.
  const today = () => toLocalDay(new Date().toISOString());

  return [
    /* ── Reservation # ─────────────────────────────────────────────── */
    c.custom<string>({
      id: "reservationNumber",
      header: tTable("resNumber"),
      accessorFn: (r) => r.reservationNumber ?? r.id.slice(0, 8).toUpperCase(),
      enableSorting: false,
      meta: { mobile: "title" },
      cell: ({ row, getValue }) => {
        const r = row.original;
        const isCancelled = r.status === "CANCELLED" || r.status === "NO_SHOW";
        return (
          <Link
            href={`/dashboard/reservations/${r.id}`}
            className={`font-mono text-xs font-semibold text-brand-600 hover:underline ltr-numbers ${
              isCancelled ? "line-through text-fg-tertiary" : ""
            }`}
          >
            {getValue() as string}
          </Link>
        );
      },
    }),

    /* ── Status ───────────────────────────────────────────────────── */
    c.status({
      id: "status",
      header: tTable("status"),
      accessor: (r) => translateDisplayStatus(r.displayStatus, tStatus),
      variant: (r) =>
        getReservationStatusBadge(
          reservationStatusKeyFromDisplayLabel(r.displayStatus),
        ),
      sortable: false,
    }),

    /* ── Guest ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "guest",
      header: tTable("guest"),
      accessorFn: (r) => `${r.tenant.firstName} ${r.tenant.lastName}`,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 1 },
      cell: ({ row }) => {
        const r = row.original;
        const isCancelled = r.status === "CANCELLED" || r.status === "NO_SHOW";
        const flag = countryFlag(r.tenant.nationality);
        return (
          <div className="min-w-0">
            <Link
              href={`/dashboard/tenants/${r.tenant.id}`}
              className="hover:underline"
            >
              <p
                className={`font-medium truncate ${
                  isCancelled ? "text-fg-tertiary" : "text-fg"
                }`}
              >
                {flag} {r.tenant.firstName} {r.tenant.lastName}
              </p>
            </Link>
            {r.tenant.classification === "vip" && (
              <span className="inline-flex text-[10px] font-bold bg-warning-50 text-warning-700 rounded px-1 mt-0.5">
                ⭐ {t("vip")}
              </span>
            )}
          </div>
        );
      },
    }),

    /* ── Units ────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "units",
      header: tTable("units"),
      accessorFn: (r) => r.units.length,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 2 },
      cell: ({ row }) => {
        const r = row.original;
        if (r.units.length === 0) {
          return <span className="text-xs text-fg-tertiary">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {r.units.slice(0, 3).map((u) => (
              <Badge key={u.id} tone="neutral" appearance="subtle" size="sm">
                {u.name}
              </Badge>
            ))}
            {r.units.length > 3 && (
              <span className="text-xs text-fg-tertiary">
                {t("moreUnits", { n: r.units.length - 3 })}
              </span>
            )}
          </div>
        );
      },
    }),

    /* ── Check-in ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "startDate",
      header: tTable("checkIn"),
      accessorFn: (r) => r.startDate,
      sortingFn: (a, b) =>
        new Date(a.original.startDate).getTime() -
        new Date(b.original.startDate).getTime(),
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tTable("checkIn") },
      cell: ({ row }) => {
        const r = row.original;
        const formatted = fmtDate(r.startDate);
        const isOverdue =
          r.status === "CONFIRMED" && toLocalDay(r.startDate) < today();
        const cls = isOverdue ? "text-error-600 font-semibold" : formatted.cls;
        return <span className={`text-sm ${cls}`}>{formatted.text}</span>;
      },
    }),

    /* ── Check-out ────────────────────────────────────────────────── */
    c.custom<string>({
      id: "endDate",
      header: tTable("checkOut"),
      accessorFn: (r) => r.endDate,
      sortingFn: (a, b) =>
        new Date(a.original.endDate).getTime() -
        new Date(b.original.endDate).getTime(),
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tTable("checkOut") },
      cell: ({ row }) => {
        const formatted = fmtDate(row.original.endDate);
        return <span className={`text-sm ${formatted.cls}`}>{formatted.text}</span>;
      },
    }),

    /* ── Duration ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "duration",
      header: tTable("duration"),
      accessorFn: (r) => fmtDuration(r),
      enableSorting: false,
      meta: { mobile: "hide" },
      cell: ({ getValue }) => (
        <span className="text-sm text-fg-tertiary">{getValue() as string}</span>
      ),
    }),

    /* ── Total ────────────────────────────────────────────────────── */
    c.currency({
      id: "grandTotal",
      header: tTable("total"),
      accessor: (r) => Number(r.grandTotal),
      showCode: false,
      mobile: "detail",
      mobilePriority: 5,
    }),

    /* ── Balance ──────────────────────────────────────────────────── */
    c.custom<number>({
      id: "balanceDue",
      header: tTable("balance"),
      accessorFn: (r) => r.balanceDue,
      sortingFn: (a, b) => a.original.balanceDue - b.original.balanceDue,
      meta: {
        align: "end",
        numeric: true,
        mobile: "detail",
        mobilePriority: 6,
        mobileLabel: tTable("balance"),
      },
      cell: ({ row }) => {
        const r = row.original;
        if (r.balanceDue === 0) {
          return (
            <span className="text-success-600 font-medium">{t("paid")}</span>
          );
        }
        return (
          <span className="text-error-600 font-semibold tabular-nums" dir="ltr">
            {r.balanceDue.toFixed(3)}
          </span>
        );
      },
    }),
  ];
}
