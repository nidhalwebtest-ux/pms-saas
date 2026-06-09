"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  EyeIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { DataTable, NoPaymentsFirstTime } from "@/components/ui";
import {
  buildPaymentColumns,
  type PaymentRow,
} from "./columns";

export interface PaymentsTableProps {
  payments: PaymentRow[];
  currency: string;
  hasActiveFilters: boolean;
}

/**
 * Client wrapper around <DataTable> for the payments list. Sort is
 * client-side (the server always returns `date desc` ordered, sorted to 200
 * rows max). Row click opens the payment detail; Print opens the receipt PDF
 * in a new tab.
 */
export default function PaymentsTable({
  payments,
  currency,
  hasActiveFilters,
}: PaymentsTableProps) {
  const router = useRouter();
  const tList = useTranslations("payments.list");
  const tTbl = useTranslations("payments.table");
  const tMethod = useTranslations("payments.methods");

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  const columns = useMemo(
    () => buildPaymentColumns({ tList, tTbl, tMethod, currency }),
    [tList, tTbl, tMethod, currency],
  );

  const rowActions = (r: PaymentRow) => [
    {
      id: "print",
      label: tList("print"),
      icon: <PrinterIcon className="h-4 w-4" />,
      onClick: () => {
        // Open the receipt PDF in a new tab — preserves the existing UX.
        window.open(`/api/payments/${r.id}/receipt-pdf`, "_blank", "noopener,noreferrer");
      },
    },
    {
      id: "view",
      label: tList("view"),
      icon: <EyeIcon className="h-4 w-4" />,
      onClick: () => router.push(`/dashboard/payments/${r.id}`),
    },
  ];

  return (
    <DataTable<PaymentRow>
      data={payments}
      columns={columns}
      mode="client"
      sorting={{ state: sorting, onChange: setSorting }}
      rowActions={rowActions}
      hasActiveFilters={hasActiveFilters}
      emptyState={
        <NoPaymentsFirstTime
          onRecord={() => router.push("/dashboard/payments/new")}
        />
      }
      aria-label={tTbl("receiptNumber")}
    />
  );
}
