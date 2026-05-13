"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
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
    <Modal open onClose={onClose} size="sm" tone="destructive">
      <ModalHeader
        title={t("title")}
        subtitle={`${expense.expenseNumber} · ${expense.amount.toFixed(3)} OMR`}
        icon={
          <div className="p-2 bg-error-100 rounded-md">
            <ExclamationTriangleIcon className="h-5 w-5 text-error-600" />
          </div>
        }
      />
      <ModalBody>
        <p className="text-sm text-fg-secondary truncate" title={expense.description}>
          {expense.description}
        </p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-fg-secondary mb-1.5">
            {t("reasonLabel")} <span className="text-error-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:ring-2 focus:ring-error-500 focus:border-error-500 focus:outline-none"
          >
            <option value="">{t("reasonPlaceholder")}</option>
            {REASON_KEYS.map((r) => <option key={r} value={r}>{tReason(r)}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-fg-secondary mb-1.5">
            {t("notesLabel")} {reason === "other" && <span className="text-error-500">*</span>}
            <span className="text-fg-tertiary font-normal"> {t("notesHint")}</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={reason === "other" ? t("notesPlaceholderOther") : t("notesPlaceholder")}
            rows={3}
            className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:ring-2 focus:ring-error-500 focus:border-error-500 focus:outline-none resize-none"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button variant="destructive" onClick={handleReject} loading={saving} disabled={!reason}>
          {t("rejectBtn")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
