"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  amount: number;
}

interface Props {
  expense: Expense;
  onClose: () => void;
  onDone: () => void;
}

const REASON_KEYS = [
  "insufficient_receipt",
  "amount_too_high",
  "not_authorized",
  "wrong_category",
  "duplicate_expense",
  "other",
];

export default function RejectExpenseModal({ expense, onClose, onDone }: Props) {
  const t = useTranslations("expenses.rejectModal");
  const tReason = useTranslations("expenses.rejectModal.reasons");
  const tErr = useTranslations("expenses.rejectModal.errors");
  const [reason, setReason] = useState("");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReject() {
    if (!reason) {
      toast.error(tErr("selectReason"));
      return;
    }
    if (reason === "other" && !notes.trim()) {
      toast.error(tErr("describeReason"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: tReason(reason), notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? tErr("rejectFailed"));
        return;
      }
      toast.success(tErr("rejected"));
      onDone();
    } catch {
      toast.error(tErr("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{t("title")}</h3>
              <p className="text-xs text-gray-500 mt-0.5 ltr-numbers">{expense.expenseNumber} · {expense.amount.toFixed(3)} OMR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/50">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-sm text-gray-700 mb-1 truncate" title={expense.description}>{expense.description}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("reasonLabel")} <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none"
            >
              <option value="">{t("reasonPlaceholder")}</option>
              {REASON_KEYS.map((r) => <option key={r} value={r}>{tReason(r)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("notesLabel")} {reason === "other" && <span className="text-red-500">*</span>}
              <span className="text-gray-400 font-normal"> {t("notesHint")}</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={reason === "other" ? t("notesPlaceholderOther") : t("notesPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleReject}
            disabled={saving || !reason}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {saving ? t("rejecting") : t("rejectBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
