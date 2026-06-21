"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui";
import { deleteCashDeposit } from "../cashier/actions";
import { buildDepositColumns, type DepositRow } from "./columns";

export default function DepositsTable({
  deposits,
  currency,
  hasActiveFilters,
  canManage,
}: {
  deposits: DepositRow[];
  currency: string;
  hasActiveFilters: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const tTbl = useTranslations("deposits.table");
  const tList = useTranslations("deposits.list");

  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const columns = useMemo(() => buildDepositColumns({ tTbl, currency }), [tTbl, currency]);

  const rowActions = canManage
    ? (r: DepositRow) => [
        {
          id: "delete",
          label: tList("delete"),
          icon: <TrashIcon className="h-4 w-4" />,
          onClick: async () => {
            if (!confirm(tList("deleteConfirm"))) return;
            const res = await deleteCashDeposit(r.groupId);
            if (res.error) { toast.error(res.error); return; }
            toast.success(tList("deleted"));
            router.refresh();
          },
        },
      ]
    : undefined;

  return (
    <DataTable<DepositRow>
      data={deposits}
      columns={columns}
      mode="client"
      sorting={{ state: sorting, onChange: setSorting }}
      rowActions={rowActions}
      hasActiveFilters={hasActiveFilters}
      aria-label={tList("title")}
    />
  );
}
