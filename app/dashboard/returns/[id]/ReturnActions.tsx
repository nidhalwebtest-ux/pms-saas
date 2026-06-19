"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui";
import { useCan } from "@/components/PermissionsProvider";
import BankSelect from "@/components/dashboard/BankSelect";
import { methodNeedsBank, methodRequiresBank } from "@/lib/banks";

interface Props {
  returnId: string;
  refundAmount: number;
  openRefundPanel?: boolean;
}

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "ONLINE" | "OTHER";

export default function ReturnActions({ returnId, refundAmount, openRefundPanel = false }: Props) {
  const router  = useRouter();
  const canRefund = useCan("returns", "CREATE");
  const t       = useTranslations("returns.actions");
  const tMethod = useTranslations("invoices.paymentMethods");

  const [show, setShow] = useState(openRefundPanel);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(refundAmount.toFixed(3));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }
    if (methodRequiresBank(method) && !bankAccountId) {
      toast.error(t("bankRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/returns/${returnId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          method,
          reference: reference || undefined,
          notes: notes || undefined,
          bankAccountId: methodNeedsBank(method) ? (bankAccountId || undefined) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("refundFailed"));
      }
      toast.success(t("refundSuccess"));
      setShow(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (!canRefund) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors"
      >
        <BanknotesIcon className="h-4 w-4" />
        {t("processRefund")}
      </button>

      <Modal open={show} onClose={() => setShow(false)} size="md">
        <ModalHeader title={t("refundTitle")} />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">{t("amountLabel")}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500 ltr-num"
                />
                <p className="mt-0.5 text-xs text-fg-tertiary ltr-num">
                  {t("refundDueHint", { amount: refundAmount.toFixed(3) })}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">{t("method")}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500"
                >
                  <option value="CASH">{tMethod("CASH")}</option>
                  <option value="BANK_TRANSFER">{tMethod("BANK_TRANSFER")}</option>
                  <option value="CARD">{tMethod("CARD")}</option>
                  <option value="CHEQUE">{tMethod("CHEQUE")}</option>
                  <option value="ONLINE">{tMethod("ONLINE")}</option>
                  <option value="OTHER">{tMethod("OTHER")}</option>
                </select>
              </div>
              {methodNeedsBank(method) && (
                <BankSelect value={bankAccountId} onChange={setBankAccountId} required={methodRequiresBank(method)} />
              )}
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">
                  {t("reference")} <span className="text-fg-tertiary">{t("optional")}</span>
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">
                  {t("notes")} <span className="text-fg-tertiary">{t("optional")}</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" type="button" onClick={() => setShow(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={loading} leftIcon={<BanknotesIcon className="h-4 w-4" />}>
              {t("confirmRefund")}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
