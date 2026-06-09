"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui";

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
    <Modal open onClose={onClose} size="sm">
      <ModalHeader
        title={t("title")}
        subtitle={`${expense.expenseNumber} · ${expense.amount.toFixed(3)} OMR`}
        icon={
          <div className="p-2 bg-info-50 rounded-md">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-info-600" />
          </div>
        }
      />
      <ModalBody>
        <p className="text-sm text-fg-secondary truncate" title={expense.description}>{expense.description}</p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-fg-secondary mb-2">
            {t("methodLabel")} <span className="text-error-500">*</span>
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors duration-fast ease-out text-start ${
                    active
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-border-default hover:border-border-strong hover:bg-subtle"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-brand-600" : "text-fg-tertiary"}`} />
                  <span className={`text-sm font-medium ${active ? "text-brand-700" : "text-fg-secondary"}`}>
                    {tMethod(m.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {paymentMethod === "bank_transfer" && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-fg-secondary mb-1.5">
              {t("bankRefLabel")} <span className="text-error-500">*</span>
            </label>
            <input
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              placeholder={t("bankRefPlaceholder")}
              className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-semibold text-fg-secondary mb-1.5">
            {t("notesLabel")} <span className="text-fg-tertiary font-normal">{t("notesOptional")}</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
            className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none resize-none"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button onClick={handleProcess} loading={saving} disabled={!paymentMethod}>
          {t("processBtn")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
