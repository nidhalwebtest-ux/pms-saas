"use client";

import Link from "next/link";
import { format as fmtDateFns } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { useLocale } from "next-intl";
import { PhotoIcon } from "@heroicons/react/24/outline";
import {
  Badge,
  defineColumns,
  getExpenseStatusBadge,
  type ExpenseStatusKey,
} from "@/components/ui";

/* ----------------------------------------------------------------------------
 *  Row shape
 * ------------------------------------------------------------------------- */

export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";

export interface ExpenseRow {
  id: string;
  expenseNumber: string;
  description: string;
  amount: number;
  status: ExpenseStatus;
  receiptImage: string;
  receiptImage2: string | null;
  notes: string | null;
  rejectionReason: string | null;
  paymentMethod: string | null;
  bankReference: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  processedAt: string | null;
  category: { id: string; name: string; icon: string | null; nameAr: string | null };
  property: { id: string; name: string };
  submittedBy: { id: string; firstName: string | null; lastName: string | null };
  reviewedBy: { id: string; firstName: string | null; lastName: string | null } | null;
  processedBy: { id: string; firstName: string | null; lastName: string | null } | null;
}

/* ----------------------------------------------------------------------------
 *  Row variant — rejected expenses dim out so PENDING/APPROVED stand out
 * ------------------------------------------------------------------------- */

export function expenseRowVariant(
  r: ExpenseRow,
): "inactive" | "default" {
  return r.status === "REJECTED" ? "inactive" : "default";
}

function fullName(u: { firstName: string | null; lastName: string | null } | null) {
  if (!u) return "—";
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

/* ----------------------------------------------------------------------------
 *  Column factory
 * ------------------------------------------------------------------------- */

type T = (key: string, params?: Record<string, string | number | Date>) => string;

export interface ExpenseColumnsDeps {
  /** `useTranslations("expenses.list")` */
  tList: T;
  /** `useTranslations("expenses.statuses")` */
  tStatus: T;
  /** From `useFormatAmount()` in lib/org-context. */
  fmtAmount: (amount: number) => string;
  /** Org currency code. */
  currency: string;
  /** Opens the receipt lightbox with the given image URLs. */
  onOpenReceipt: (images: string[]) => void;
}

export function buildExpenseColumns({
  tList,
  tStatus,
  fmtAmount,
  currency,
  onOpenReceipt,
}: ExpenseColumnsDeps) {
  const c = defineColumns<ExpenseRow>();

  return [
    /* ── Expense # ─────────────────────────────────────────────────── */
    c.custom<string>({
      id: "expenseNumber",
      header: tList("table.expenseNumber"),
      accessorFn: (r) => r.expenseNumber,
      enableSorting: false,
      meta: { mobile: "title" },
      cell: ({ row, getValue }) => (
        <Link
          href={`/dashboard/expenses/${row.original.id}`}
          className="font-mono text-xs font-semibold text-brand-600 hover:underline ltr-numbers"
        >
          {getValue() as string}
        </Link>
      ),
    }),

    /* ── Date ──────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "submittedAt",
      header: tList("table.date"),
      accessorFn: (r) => r.submittedAt,
      sortingFn: (a, b) =>
        new Date(a.original.submittedAt).getTime() -
        new Date(b.original.submittedAt).getTime(),
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tList("table.date") },
      cell: ({ row }) => <DateText iso={row.original.submittedAt} />,
    }),

    /* ── Category ──────────────────────────────────────────────────── */
    c.custom<string>({
      id: "category",
      header: tList("table.category"),
      accessorFn: (r) => r.category.name,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 3, mobileLabel: tList("table.category") },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
          <span className="text-base">{row.original.category.icon ?? "📋"}</span>
          {row.original.category.name}
        </span>
      ),
    }),

    /* ── Description ───────────────────────────────────────────────── */
    c.custom<string>({
      id: "description",
      header: tList("table.description"),
      accessorFn: (r) => r.description,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 4, mobileLabel: tList("table.description") },
      cell: ({ row }) => (
        <span
          className="block text-xs text-fg max-w-[280px] truncate"
          title={row.original.description}
        >
          {row.original.description}
        </span>
      ),
    }),

    /* ── Building ──────────────────────────────────────────────────── */
    c.custom<string>({
      id: "property",
      header: tList("table.building"),
      accessorFn: (r) => r.property.name,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 5, mobileLabel: tList("table.building") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-secondary whitespace-nowrap">
          {row.original.property.name}
        </span>
      ),
    }),

    /* ── Receipt ───────────────────────────────────────────────────── */
    c.custom<string>({
      id: "receipt",
      header: tList("table.receipt"),
      accessorFn: (r) => r.receiptImage,
      enableSorting: false,
      meta: { align: "center", mobile: "hide" },
      cell: ({ row }) => {
        const r = row.original;
        const images = [r.receiptImage, ...(r.receiptImage2 ? [r.receiptImage2] : [])].filter(Boolean);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReceipt(images);
            }}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg overflow-hidden ring-1 ring-border-default hover:ring-brand-400 transition-all bg-subtle"
            title={tList("rowActions.viewReceipt")}
            disabled={images.length === 0}
          >
            {r.receiptImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.receiptImage}
                alt={tList("table.receipt")}
                className="object-cover w-full h-full"
              />
            ) : (
              <PhotoIcon className="h-4 w-4 text-fg-tertiary" />
            )}
          </button>
        );
      },
    }),

    /* ── Submitted by ──────────────────────────────────────────────── */
    c.custom<string>({
      id: "submittedBy",
      header: tList("table.submittedBy"),
      accessorFn: (r) => fullName(r.submittedBy),
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 6, mobileLabel: tList("table.submittedBy") },
      cell: ({ row }) => (
        <span className="text-xs text-fg-secondary whitespace-nowrap">
          {fullName(row.original.submittedBy)}
        </span>
      ),
    }),

    /* ── Amount ────────────────────────────────────────────────────── */
    c.custom<number>({
      id: "amount",
      header: tList("table.amount"),
      accessorFn: (r) => r.amount,
      sortingFn: (a, b) => a.original.amount - b.original.amount,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 1, mobileLabel: tList("table.amount") },
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          <span className="text-sm font-bold text-error-600 tabular-nums" dir="ltr">
            {fmtAmount(row.original.amount)}
          </span>
          <span className="text-[10px] text-fg-tertiary ms-1">{currency}</span>
        </span>
      ),
    }),

    /* ── Status ────────────────────────────────────────────────────── */
    c.custom<string>({
      id: "status",
      header: tList("table.status"),
      accessorFn: (r) => r.status,
      sortingFn: "alphanumeric",
      meta: { align: "center", mobile: "status" },
      cell: ({ row }) => (
        <Badge
          {...getExpenseStatusBadge(row.original.status as ExpenseStatusKey)}
          size="sm"
          pulse={row.original.status === "PENDING"}
        >
          {tStatus(row.original.status)}
        </Badge>
      ),
    }),
  ];
}

/* ----------------------------------------------------------------------------
 *  DateText — small component so we can call useLocale() inside the cell.
 *  (Cell renderers are React components, so hooks are legal inside them.)
 * ------------------------------------------------------------------------- */

function DateText({ iso }: { iso: string | null }) {
  const locale = useLocale();
  if (!iso) return <span className="text-fg-tertiary">—</span>;
  const dfLoc = locale === "ar" ? arLocale : enLocale;
  return (
    <span className="text-xs text-fg-secondary ltr-numbers whitespace-nowrap">
      {fmtDateFns(new Date(iso), "dd MMM yyyy", { locale: dfLoc })}
    </span>
  );
}
