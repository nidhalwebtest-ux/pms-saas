"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@heroicons/react/24/outline";
import { deleteCashDeposit } from "./actions";

export interface DepositRow {
  groupId: string;
  dateText: string;
  bankName: string;
  amount: number;
  reference: string | null;
}

export default function DepositsList({
  deposits,
  canManage,
}: {
  deposits: DepositRow[];
  canManage: boolean;
}) {
  const t = useTranslations("settings.cashier");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const money = (n: number) => `${n.toFixed(3)} OMR`;

  async function remove(groupId: string) {
    if (!confirm(t("deleteDepositConfirm"))) return;
    setBusy(groupId);
    const res = await deleteCashDeposit(groupId);
    setBusy(null);
    if (res.error) { toast.error(t(`errors.${res.error}`) ?? t("errors.generic")); return; }
    toast.success(t("depositDeletedToast"));
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{t("recentDeposits")}</h3>
      </div>
      {deposits.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">{t("noDeposits")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 text-start">{t("col.date")}</th>
                <th className="px-4 py-2 text-start">{t("depositToBank")}</th>
                <th className="px-4 py-2 text-start">{t("depositReference")}</th>
                <th className="px-4 py-2 text-end">{t("depositAmount")}</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deposits.map((d) => (
                <tr key={d.groupId}>
                  <td className="px-4 py-2.5 text-gray-700 ltr-numbers">{d.dateText}</td>
                  <td className="px-4 py-2.5 text-gray-700">{d.bankName}</td>
                  <td className="px-4 py-2.5 text-gray-500 ltr-numbers">{d.reference || "—"}</td>
                  <td className="px-4 py-2.5 text-end font-medium text-gray-900 ltr-numbers">{money(d.amount)}</td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-end">
                      <button
                        onClick={() => remove(d.groupId)}
                        disabled={busy === d.groupId}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title={t("deleteDeposit")}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
