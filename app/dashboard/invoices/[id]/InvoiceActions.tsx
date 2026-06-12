"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PrinterIcon,
  CreditCardIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui";

interface Props {
  invoiceId: string;
  status: string;
  balanceDue: number;
  openPaymentPanel?: boolean;
}

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "ONLINE" | "OTHER";

export default function InvoiceActions({ invoiceId, status, balanceDue, openPaymentPanel = false }: Props) {
  const router = useRouter();
  const t       = useTranslations("invoices.actions");
  const tMethod = useTranslations("invoices.paymentMethods");

  const [issuing, setIssuing] = useState(false);
  const [showPayment, setShowPayment] = useState(openPaymentPanel);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [amount, setAmount] = useState(balanceDue.toFixed(3));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // ESC and scroll lock are handled by Modal (Headless UI).

  async function handleIssue() {
    setIssuing(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/issue`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("issueFailed"));
      }
      toast.success(t("issueSuccess"));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || t("somethingWentWrong"));
    } finally {
      setIssuing(false);
    }
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          method,
          reference: reference || undefined,
          date: paymentDate,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("paymentFailed"));
      }
      toast.success(t("paymentSuccess"));
      setShowPayment(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || t("somethingWentWrong"));
    } finally {
      setPaymentLoading(false);
    }
  }

  const canIssue = status === "DRAFT";
  const canPay = status === "ISSUED" || status === "PARTIALLY_PAID" || status === "PENDING";
  const isCancelled = status === "CANCELLED";

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canIssue && (
          <button
            onClick={handleIssue}
            disabled={issuing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60 transition-colors"
          >
            <CheckCircleIcon className="h-4 w-4" />
            {issuing ? t("issuing") : t("issueInvoice")}
          </button>
        )}
        {canPay && (
          <button
            onClick={() => setShowPayment(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors"
          >
            <CreditCardIcon className="h-4 w-4" />
            {t("recordPayment")}
          </button>
        )}
        {!isCancelled && (
          <a
            href={`/api/invoices/${invoiceId}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <PrinterIcon className="h-4 w-4" />
            {t("printPdf")}
          </a>
        )}
      </div>

      {/* Payment modal */}
      {canPay && (
        <Modal open={showPayment} onClose={() => setShowPayment(false)} size="md">
          <ModalHeader title={t("inlineTitle")} />
          <form id="invoice-payment-form" onSubmit={handlePaymentSubmit}>
            <ModalBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-fg-secondary mb-1">
                    {t("amountLabel")}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={balanceDue}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500 ltr-num"
                  />
                  <p className="mt-0.5 text-xs text-fg-tertiary ltr-num">
                    {t("balanceDueHint", { amount: balanceDue.toFixed(3) })}
                  </p>
                </div>

                {/* Method */}
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

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-fg-secondary mb-1">{t("date")}</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500 ltr-num"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-xs font-medium text-fg-secondary mb-1">
                    {t("reference")} <span className="text-fg-tertiary">{t("optional")}</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t("referencePlaceholder")}
                    className="w-full rounded-md border border-border-default px-3 py-2 text-sm focus:border-success-500 focus:outline-none focus:ring-1 focus:ring-success-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
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
              <Button variant="ghost" type="button" onClick={() => setShowPayment(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                loading={paymentLoading}
                leftIcon={<CreditCardIcon className="h-4 w-4" />}
              >
                {t("confirmPayment")}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
}
