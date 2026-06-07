"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { EyeIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import { DataTable, EmptyState } from "@/components/ui";
import {
  buildReturnColumns,
  returnRowVariant,
  type ReturnRow,
} from "./columns";

export interface ReturnsTableProps {
  returns: ReturnRow[];
  currency: string;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export default function ReturnsTable({
  returns,
  currency,
  pageIndex,
  pageSize,
  totalCount,
}: ReturnsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tTbl    = useTranslations("returns.table");
  const tStatus = useTranslations("returns.statuses");
  const tType   = useTranslations("returns.types");
  const tRow    = useTranslations("returns.rowActions");
  const tEmpty  = useTranslations("returns.empty");
  const locale  = useLocale();

  const columns = useMemo(
    () => buildReturnColumns({ tTbl, tStatus, tType, currency, locale }),
    [tTbl, tStatus, tType, currency, locale],
  );

  function pushWithParams(nextParams: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(nextParams)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`/dashboard/returns${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  return (
    <DataTable<ReturnRow>
      data={returns}
      columns={columns}
      mode="server"
      pagination={{
        pageIndex,
        pageSize,
        totalCount,
        onChange: ({ pageIndex: next }) => {
          pushWithParams({ page: String(next + 1) });
        },
      }}
      rowActions={(r) => [
        {
          id: "view",
          label: tRow("view"),
          icon: <EyeIcon className="h-4 w-4" />,
          visible: true,
          onClick: () => router.push(`/dashboard/returns/${r.id}`),
        },
        {
          id: "refund",
          label: tRow("processRefund"),
          icon: <BanknotesIcon className="h-4 w-4" />,
          visible: r.status !== "cancelled" && r.refundRequired && r.refundStatus === "PENDING",
          onClick: () => router.push(`/dashboard/returns/${r.id}?action=refund`),
        },
      ]}
      rowVariant={returnRowVariant}
      hasActiveFilters={
        !!searchParams.get("search") ||
        (searchParams.get("status") ?? "ALL") !== "ALL" ||
        !!searchParams.get("propertyId")
      }
      emptyState={
        <EmptyState
          title={tEmpty("firstTitle")}
          description={tEmpty("firstDesc")}
          primaryAction={{
            label: tEmpty("goToReservations"),
            onClick: () => router.push("/dashboard/reservations"),
          }}
        />
      }
      noResultsState={
        <EmptyState
          variant="neutral"
          title={tEmpty("noResultsTitle")}
          description={tEmpty("noResultsDesc")}
          primaryAction={{
            label: tEmpty("clearFilters"),
            onClick: () => router.push("/dashboard/returns"),
          }}
        />
      }
      aria-label={tTbl("returnNumber")}
    />
  );
}
