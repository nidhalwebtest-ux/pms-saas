"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import BankSelect from "@/components/dashboard/BankSelect";
import { createCashDeposit } from "../../cashier/actions";

interface BuildingOpt { id: string; name: string; balance: number }

export default function NewDepositForm({ buildings, lockedPropertyId }: { buildings: BuildingOpt[]; lockedPropertyId?: string }) {
  const t = useTranslations("settings.cashier");
  const tNew = useTranslations("deposits.new");
  const router = useRouter();

  const [propertyId, setPropertyId] = useState(lockedPropertyId || buildings[0]?.id || "");
  const buildingLocked = !!lockedPropertyId;
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const money = (n: number) => `${n.toFixed(3)} OMR`;
  const balance = buildings.find((b) => b.id === propertyId)?.balance ?? 0;
  const amountNum = parseFloat(amount);

  async function submit() {
    if (!propertyId) { toast.error(t("errors.no_building")); return; }
    if (!bankAccountId) { toast.error(t("errors.bank")); return; }
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) { toast.error(t("errors.amount")); return; }
    if (amountNum > balance + 0.0005) { toast.error(t("errors.insufficient_cash")); return; }

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
    router.push("/dashboard/deposits");
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label={tNew("building")} required>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            disabled={buildingLocked}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
          >
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">{t("drawerBalance")}: <span className="ltr-numbers font-semibold text-gray-700">{money(balance)}</span></p>
          {buildingLocked && <p className="mt-0.5 text-[11px] text-gray-400">{tNew("lockedHint")}</p>}
        </Field>

        <Field label={t("depositToBank")} required>
          <BankSelect value={bankAccountId} onChange={setBankAccountId} required />
        </Field>

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

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={submit} loading={saving} disabled={balance <= 0}>
          <ArrowUpTrayIcon className="h-4 w-4" />
          {saving ? t("depositing") : t("depositBtn")}
        </Button>
        <button onClick={() => router.push("/dashboard/deposits")} className="text-sm text-gray-500 hover:text-gray-700">
          {tNew("cancel")}
        </button>
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
