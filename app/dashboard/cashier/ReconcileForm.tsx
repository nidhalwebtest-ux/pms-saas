"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import BankSelect from "@/components/dashboard/BankSelect";
import { createCashierReconciliation } from "./actions";

interface Bank { id: string; bankName: string; label: string | null; isDefault: boolean; isActive: boolean }

export default function ReconcileForm({
  businessDate,
  expectedCash,
  banks,
}: {
  businessDate: string;
  expectedCash: number;
  banks: Bank[];
}) {
  const t = useTranslations("settings.cashier");
  const router = useRouter();

  const [counted, setCounted] = useState("");
  const [deposit, setDeposit] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const countedNum = parseFloat(counted);
  const variance = Number.isFinite(countedNum) ? countedNum - expectedCash : null;
  const money = (n: number) => `${n.toFixed(3)} OMR`;

  async function submit() {
    if (!counted || !Number.isFinite(countedNum) || countedNum < 0) {
      toast.error(t("errors.counted"));
      return;
    }
    if (deposit && !bankAccountId) { toast.error(t("errors.bank")); return; }
    if (deposit && (!depositAmount || parseFloat(depositAmount) <= 0)) { toast.error(t("errors.amount")); return; }

    const fd = new FormData();
    fd.set("businessDate", businessDate);
    fd.set("countedCash", counted);
    fd.set("notes", notes);
    if (deposit) {
      fd.set("depositBankAccountId", bankAccountId);
      fd.set("depositedAmount", depositAmount);
      fd.set("depositReference", depositReference);
    }

    setSaving(true);
    const res = await createCashierReconciliation(fd);
    setSaving(false);
    if (res.error) { toast.error(t(`errors.${res.error}`) ?? t("errors.generic")); return; }
    toast.success(t("saved"));
    setCounted(""); setDeposit(false); setDepositAmount(""); setDepositReference(""); setNotes("");
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">{t("reconcileTitle")}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("expectedCash")}>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ltr-numbers">{money(expectedCash)}</div>
        </Field>
        <Field label={t("countedCash")} required>
          <input
            inputMode="decimal" value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0.000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
        <Field label={t("variance")}>
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ltr-numbers ${variance === null ? "bg-gray-50 text-gray-400" : Math.abs(variance) < 0.001 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {variance === null ? "—" : `${variance > 0 ? "+" : ""}${money(variance)}`}
          </div>
        </Field>
      </div>

      {/* Deposit */}
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={deposit} onChange={(e) => { setDeposit(e.target.checked); if (e.target.checked && !depositAmount && counted) setDepositAmount(counted); }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        {t("depositToggle")}
      </label>

      {deposit && (
        <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg bg-blue-50/40 p-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <BankSelect value={bankAccountId} onChange={setBankAccountId} required />
          </div>
          <Field label={t("depositAmount")} required>
            <input
              inputMode="decimal" value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
          <Field label={t("depositReference")}>
            <input
              value={depositReference}
              onChange={(e) => setDepositReference(e.target.value)}
              placeholder={t("depositReferencePlaceholder")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </Field>
        </div>
      )}

      <div className="mt-4">
        <Field label={t("notes")}>
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
      </div>

      <div className="mt-5">
        <Button onClick={submit} loading={saving} disabled={banks.length === 0 && deposit}>
          {deposit ? t("reconcileDepositBtn") : t("reconcileBtn")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
