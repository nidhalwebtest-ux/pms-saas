"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PrinterIcon,
  CreditCardIcon,
  CheckCircleIcon,
  TrashIcon,
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
  const [issuing, setIssuing] = useState(false);
  const [showPayment, setShowPayment] = useState(openPaymentPanel);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [amount, setAmount] = useState(balanceDue.toFixed(3));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function handleIssue() {
    setIssuing(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/issue`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to issue invoice");
      }
      toast.success("Invoice issued successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setIssuing(false);
    }
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Please enter a valid amount");
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
        throw new Error(data.error || "Failed to record payment");
      }
      toast.success("Payment recorded");
      setShowPayment(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setPaymentLoading(false);
    }
  }

  const canIssue = status === "DRAFT";
  const canPay = status === "ISSUED" || status === "PARTIALLY_PAID";
  const isPaid = status === "PAID";
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
            {issuing ? "Issuing…" : "Issue Invoice"}
          </button>
        )}
        {canPay && (
          <button
            onClick={() => setShowPayment((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors"
          >
            <CreditCardIcon className="h-4 w-4" />
            Record Payment
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
            Print / PDF
          </a>
        )}
      </div>

      {/* Inline payment form */}
      {showPayment && canPay && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-green-900">Record Payment</h3>
          <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount (OMR)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <p className="mt-0.5 text-xs text-gray-400">Balance due: {balanceDue.toFixed(3)} OMR</p>
            </div>

            {/* Method */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reference <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TXN-001, cheque #…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Buttons */}
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <button
                type="submit"
                disabled={paymentLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60 transition-colors"
              >
                <CreditCardIcon className="h-4 w-4" />
                {paymentLoading ? "Saving…" : "Confirm Payment"}
              </button>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
