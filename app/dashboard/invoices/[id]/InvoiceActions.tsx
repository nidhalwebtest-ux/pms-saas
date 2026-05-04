"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  PrinterIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

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

  // Close modal on Esc
  useEffect(() => {
    if (!showPayment) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowPayment(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPayment]);

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
            href={`/dashboard/invoices/${invoiceId}/print`}
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
      {showPayment && canPay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPayment(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{t("inlineTitle")}</h3>
              <button
                onClick={() => setShowPayment(false)}
                className="rounded-full p-1 hover:bg-gray-100 transition-colors"
                aria-label={t("cancel")}
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 ltr-numbers"
                  />
                  <p className="mt-0.5 text-xs text-gray-400 ltr-numbers">
                    {t("balanceDueHint", { amount: balanceDue.toFixed(3) })}
                  </p>
                </div>

                {/* Method */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t("method")}</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t("date")}</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 ltr-numbers"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("reference")} <span className="text-gray-400">{t("optional")}</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={t("referencePlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("notes")} <span className="text-gray-400">{t("optional")}</span>
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPayment(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60 transition-colors"
                >
                  <CreditCardIcon className="h-4 w-4" />
                  {paymentLoading ? t("saving") : t("confirmPayment")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
