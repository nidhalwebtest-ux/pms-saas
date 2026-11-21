"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import BankSelect from "@/components/dashboard/BankSelect";
import { createCashDeposit } from "./actions";

export default function DepositForm({
  propertyId,
  drawerBalance,
}: {
  propertyId: string;
  drawerBalance: number;
}) {
  const t = useTranslations("settings.cashier");
  const router = useRouter();

  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const money = (n: number) => `${n.toFixed(3)} OMR`;
  const amountNum = parseFloat(amount);

  async function submit() {
    if (!bankAccountId) { toast.error(t("errors.bank")); return; }
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) { toast.error(t("errors.amount")); return; }
    if (amountNum > drawerBalance + 0.0005) { toast.error(t("errors.insufficient_cash")); return; }

    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("bankAccountId", bankAccountId);
    fd.set("amount", amount);
    fd.set("reference", reference);

    setSaving(true);
    const res = await createCashDeposit(fd);
    setSaving(false);
    if (res.error) { toast.error(t(`errors.${res.error}`) ?? t("errors.generic")); return; }
    toast.success(t("depositedToast"));
    setAmount(""); setReference("");
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t("depositTitle")}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{t("depositSubtitle")}</p>
        </div>
        <div className="text-end">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("drawerBalance")}</p>
          <p className="text-sm font-semibold text-gray-900 ltr-numbers">{money(drawerBalance)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">{t("depositToBank")} <span className="text-red-500">*</span></label>
          <BankSelect value={bankAccountId} onChange={setBankAccountId} required />
        </div>
        <Field label={t("depositAmount")} required>
          <input
            inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-end ltr-numbers focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
        <Field label={t("depositReference")}>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t("depositReferencePlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </Field>
      </div>

      <div className="mt-5">
        <Button onClick={submit} loading={saving} disabled={drawerBalance <= 0}>
          <ArrowUpTrayIcon className="h-4 w-4" />
          {saving ? t("depositing") : t("depositBtn")}
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
