"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

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
  { key: "petty_cash",   label: "Paid from petty cash",  icon: BanknotesIcon },
  { key: "bank_transfer", label: "Bank transfer",         icon: BuildingLibraryIcon },
  { key: "already_paid",  label: "Already paid (record only)", icon: CheckBadgeIcon },
] as const;

export default function ProcessExpenseModal({ expense, onClose, onDone }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleProcess() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (paymentMethod === "bank_transfer" && !bankReference.trim()) {
      toast.error("Bank reference is required for bank transfer");
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
        toast.error(data.error ?? "Failed to process");
        return;
      }
      toast.success("Expense processed");
      onDone();
    } catch {
      toast.error("Network error");
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
              <h3 className="text-base font-semibold text-gray-900">Process Expense</h3>
              <p className="text-xs text-gray-500 mt-0.5">{expense.expenseNumber} · {expense.amount.toFixed(3)} OMR</p>
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
              Payment method <span className="text-red-500">*</span>
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      active
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${active ? "text-blue-900" : "text-gray-700"}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "bank_transfer" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Bank reference <span className="text-red-500">*</span>
              </label>
              <input
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="Transaction ID or reference number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Processing notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…"
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
            Cancel
          </button>
          <button
            onClick={handleProcess}
            disabled={saving || !paymentMethod}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Processing…" : "Mark as Processed"}
          </button>
        </div>
      </div>
    </div>
  );
}
