"use client";

import Link from "next/link";
import { Badge, defineColumns } from "@/components/ui";
import { waLink } from "@/utils/whatsapp";
import type { VendorRow } from "./page";

type T = (key: string, params?: Record<string, string | number>) => string;

export interface VendorColumnsDeps {
  tTable: T;
}

export function vendorRowVariant(r: VendorRow): "inactive" | "default" {
  return r.isActive ? "default" : "inactive";
}

export function buildVendorColumns({ tTable }: VendorColumnsDeps) {
  const c = defineColumns<VendorRow>();

  return [
    c.custom<string>({
      id: "name",
      header: tTable("name"),
      accessorFn: (r) => r.name,
      sortingFn: "alphanumeric",
      meta: { mobile: "title" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <Link
              href={`/dashboard/vendors/${r.id}`}
              className="text-sm font-semibold text-fg hover:text-brand-600 transition-colors truncate"
            >
              {r.name}
            </Link>
            {r.nameAr && (
              <div className="text-xs text-fg-tertiary truncate" dir="rtl">{r.nameAr}</div>
            )}
          </div>
        );
      },
    }),

    c.custom<string | null>({
      id: "category",
      header: tTable("category"),
      accessorFn: (r) => r.categoryName,
      sortingFn: "alphanumeric",
      meta: { mobile: "detail", mobilePriority: 1, mobileLabel: tTable("category") },
      cell: ({ row }) => (
        <span className="text-sm text-fg-secondary">{row.original.categoryName ?? "—"}</span>
      ),
    }),

    c.custom<string | null>({
      id: "phone",
      header: tTable("phone"),
      accessorFn: (r) => r.phone,
      enableSorting: false,
      meta: { mobile: "detail", mobilePriority: 2, mobileLabel: tTable("phone") },
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return <span className="text-sm text-fg-tertiary">—</span>;
        const href = waLink(phone);
        return href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-success-50 px-2 py-1 text-xs font-medium text-success-700 hover:bg-success-100 ltr-numbers"
          >
            {phone}
          </a>
        ) : (
          <span className="text-sm text-fg ltr-numbers">{phone}</span>
        );
      },
    }),

    c.custom<number>({
      id: "totalSpend",
      header: tTable("totalSpendYear"),
      accessorFn: (r) => r.totalSpendThisYear,
      meta: { align: "end", numeric: true, mobile: "detail", mobilePriority: 3, mobileLabel: tTable("totalSpendYear") },
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold text-fg tabular-nums ltr-numbers" dir="ltr">
          {(getValue() as number).toFixed(3)} OMR
        </span>
      ),
    }),

    c.custom<number>({
      id: "expenseCount",
      header: tTable("expenseCount"),
      accessorFn: (r) => r.expenseCount,
      meta: { align: "center", numeric: true, mobile: "detail", mobilePriority: 4, mobileLabel: tTable("expenseCount") },
      cell: ({ getValue }) => (
        <span className="text-sm text-fg tabular-nums" dir="ltr">{getValue() as number}</span>
      ),
    }),

    c.custom<boolean>({
      id: "isActive",
      header: tTable("status"),
      accessorFn: (r) => r.isActive,
      meta: { mobile: "detail", mobilePriority: 5, mobileLabel: tTable("status") },
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge tone="success" appearance="subtle" size="sm">{tTable("active")}</Badge>
        ) : (
          <Badge tone="neutral" appearance="subtle" size="sm">{tTable("inactive")}</Badge>
        ),
    }),
  ];
}
