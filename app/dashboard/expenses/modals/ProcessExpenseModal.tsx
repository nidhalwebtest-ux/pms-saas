"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";

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

const METHODS = [
  { key: "petty_cash",    icon: BanknotesIcon },
  { key: "bank_transfer", icon: BuildingLibraryIcon },
  { key: "already_paid",  icon: CheckBadgeIcon },
] as const;

export default function ProcessExpenseModal({ expense, onClose, onDone }: Props) {
  const t = useTranslations("expenses.processModal");
  const tMethod = useTranslations("expenses.processModal.methods");
  const tErr = useTranslations("expenses.processModal.errors");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleProcess() {
    if (!paymentMethod) {
      toast.error(tErr("selectMethod"));
      return;
    }
    if (paymentMethod === "bank_transfer" && !bankReference.trim()) {
      toast.error(tErr("bankRefRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}/process`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, bankReference, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? tErr("processFailed"));
        return;
      }
      toast.success(tErr("processed"));
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
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600" />
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
          <p className="text-sm text-gray-700 truncate" title={expense.description}>{expense.description}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              {t("methodLabel")} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-start ${
                      active
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${active ? "text-blue-900" : "text-gray-700"}`}>
                      {tMethod(m.key)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "bank_transfer" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("bankRefLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder={t("bankRefPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t("notesLabel")} <span className="text-gray-400 font-normal">{t("notesOptional")}</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none"
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
          <Button
            onClick={handleProcess}
            loading={saving}
            disabled={!paymentMethod}
          >
            {t("processBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
