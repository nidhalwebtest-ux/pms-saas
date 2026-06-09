"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  CheckCircleIcon,
  CreditCardIcon,
  EyeIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import {
  DataTable,
  NoInvoicesFirstTime,
  NoInvoicesForFilters,
} from "@/components/ui";
import {
  buildInvoiceColumns,
  invoiceRowVariant,
  type InvoiceRow,
} from "./columns";

export interface InvoicesTableProps {
  invoices: InvoiceRow[];
  currency: string;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Client wrapper around <DataTable> for the invoices list. Pagination state
 * lives in the URL — `onChange` pushes a new query and Next.js refetches the
 * server component. The table itself is "use client" because TanStack and the
 * DataTable runtime require client hooks; everything above this (header,
 * tabs, search, status counts) stays server-rendered.
 */
export default function InvoicesTable({
  invoices,
  currency,
  pageIndex,
  pageSize,
  totalCount,
}: InvoicesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tTbl = useTranslations("invoices.table");
  const tStatus = useTranslations("invoices.statuses");
  const tRow = useTranslations("invoices.rowActions");
  const locale = useLocale();

  const columns = useMemo(
    () => buildInvoiceColumns({ tTbl, tStatus, currency, locale }),
    [tTbl, tStatus, currency, locale],
  );

  function pushWithParams(nextParams: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(nextParams)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`/dashboard/invoices${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <DataTable<InvoiceRow>
      data={invoices}
      columns={columns}
      mode="server"
      pagination={{
        pageIndex,
        pageSize,
        totalCount,
        onChange: ({ pageIndex: next }) => {
          // 1-based page in the URL; server reads `?page=`.
          pushWithParams({ page: String(next + 1) });
        },
      }}
      rowActions={(r) => {
        const isDraft = r.status === "DRAFT";
        const isCancelled = r.status === "CANCELLED";
        const hasBalance = r.balanceDue > 0;
        return [
          {
            id: "issue",
            label: tRow("issue"),
            icon: <CheckCircleIcon className="h-4 w-4" />,
            visible: isDraft,
            onClick: () => router.push(`/dashboard/invoices/${r.id}`),
          },
          {
            id: "pay",
            label: tRow("pay"),
            icon: <CreditCardIcon className="h-4 w-4" />,
            visible: !isDraft && !isCancelled && hasBalance,
            onClick: () =>
              router.push(`/dashboard/invoices/${r.id}?action=payment`),
          },
          {
            id: "print",
            label: tRow("print"),
            icon: <PrinterIcon className="h-4 w-4" />,
            visible: !isDraft && !isCancelled,
            onClick: () => router.push(`/dashboard/invoices/${r.id}/print`),
          },
          {
            id: "view",
            label: tRow("view"),
            icon: <EyeIcon className="h-4 w-4" />,
            visible: isCancelled,
            onClick: () => router.push(`/dashboard/invoices/${r.id}`),
          },
        ];
      }}
      rowVariant={invoiceRowVariant}
      hasActiveFilters={
        !!searchParams.get("search") ||
        (searchParams.get("status") ?? "ALL") !== "ALL" ||
        !!searchParams.get("propertyId")
      }
      emptyState={
        <NoInvoicesFirstTime
          onCreate={() => router.push("/dashboard/reservations")}
        />
      }
      noResultsState={
        <NoInvoicesForFilters
          onClearFilters={() => router.push("/dashboard/invoices")}
        />
      }
      aria-label={tTbl("invoiceNumber")}
    />
  );
}
