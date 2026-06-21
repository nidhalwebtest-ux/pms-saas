"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui";
import { buildAdjustmentColumns, type AdjustmentRow } from "./columns";

export default function AdjustmentsTable({
  adjustments,
  currency,
  hasActiveFilters,
}: {
  adjustments: AdjustmentRow[];
  currency: string;
  hasActiveFilters: boolean;
}) {
  const tTbl = useTranslations("adjustments.table");
  const tList = useTranslations("adjustments.list");

  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const columns = useMemo(() => buildAdjustmentColumns({ tTbl, currency }), [tTbl, currency]);

  return (
    <DataTable<AdjustmentRow>
      data={adjustments}
      columns={columns}
      mode="client"
      sorting={{ state: sorting, onChange: setSorting }}
      hasActiveFilters={hasActiveFilters}
      aria-label={tList("title")}
    />
  );
}
