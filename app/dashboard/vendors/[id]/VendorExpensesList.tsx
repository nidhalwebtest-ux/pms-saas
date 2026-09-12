"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, getExpenseStatusBadge, type ExpenseStatusKey } from "@/components/ui";

export interface VendorExpenseRow {
  id: string;
  expenseNumber: string;
  description: string;
  amount: number;
  status: string;
  submittedAt: string; // ISO
  propertyName: string;
  categoryName: string;
}

export default function VendorExpensesList({ expenses }: { expenses: VendorExpenseRow[] }) {
  const t = useTranslations("vendors.detail.expenses");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.submittedAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [expenses, from, to]);

  const total = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.status === "APPROVED" || e.status === "PROCESSED" ? e.amount : 0), 0),
    [filtered],
  );

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-700">{t("title")}</h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />
          <span className="text-xs text-gray-400">{t("to")}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
            {filtered.map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/expenses/${e.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{e.description}</span>
                    <Badge {...getExpenseStatusBadge(e.status as ExpenseStatusKey)} size="sm">
                      {t(`status.${e.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {e.expenseNumber} · {e.categoryName} · {e.propertyName} · {new Date(e.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-shrink-0 text-sm font-semibold text-gray-900 ltr-numbers">
                  {e.amount.toFixed(3)} OMR
                </div>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-3">
            <span className="text-xs text-gray-500">{t("runningTotal")}</span>
            <span className="text-sm font-bold text-gray-900 ltr-numbers">{total.toFixed(3)} OMR</span>
          </div>
        </>
      )}
    </div>
  );
}
