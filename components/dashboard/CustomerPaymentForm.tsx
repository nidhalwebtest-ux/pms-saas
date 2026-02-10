"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SearchableSelect, {
  SelectOption,
} from "@/components/ui/SearchableSelect";
import CreateTenantModal from "@/app/dashboard/@modal/CreateTenantModal";
import {
  getTenantFinancials,
  createCustomerPayment,
} from "@/app/dashboard/payments/actions";
import { DocumentTextIcon, CalculatorIcon } from "@heroicons/react/24/outline";

export default function CustomerPaymentForm({ tenants }: { tenants: any[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- State ---
  const [tenantOptions, setTenantOptions] = useState<SelectOption[]>(
    tenants.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` })),
  );
  const [selectedTenant, setSelectedTenant] = useState<SelectOption | null>(
    null,
  );

  // Financials
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenantBalance, setTenantBalance] = useState(0);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Effects ---
  // When Tenant changes, fetch their debt
  useEffect(() => {
    if (selectedTenant?.id) {
      setLoadingFinancials(true);
      getTenantFinancials(String(selectedTenant.id))
        .then((data) => {
          setInvoices(data.invoices);
          setTenantBalance(data.balance);
        })
        .finally(() => setLoadingFinancials(false));
    } else {
      setInvoices([]);
      setTenantBalance(0);
    }
  }, [selectedTenant]);

  // --- Handlers ---

  // Logic: When an invoice is checked, add to total. When unchecked, subtract.
  const toggleInvoice = (invoiceId: string, amount: number) => {
    const newSet = new Set(selectedInvoiceIds);
    let newAmount = paymentAmount;

    if (newSet.has(invoiceId)) {
      newSet.delete(invoiceId);
      // Optional: Auto-subtract amount? Usually users prefer manual control or auto-add.
      // Let's Auto-Subtract for better UX
      newAmount -= amount;
    } else {
      newSet.add(invoiceId);
      // Auto-Add amount
      newAmount += amount;
    }

    setSelectedInvoiceIds(newSet);
    setPaymentAmount(parseFloat(newAmount.toFixed(3)));
  };

  const handleAutoApply = () => {
    // NetSuite Logic: Apply payment amount to oldest invoices first
    let remaining = paymentAmount;
    const newSet = new Set<string>();

    // Sort invoices by date (already sorted from server, but ensure)
    const sorted = [...invoices].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    for (const inv of sorted) {
      if (remaining <= 0) break;
      // Select this invoice (even if partial)
      newSet.add(inv.id);
      const invAmount = Number(inv.amount);
      if (remaining >= invAmount) {
        // We can fully pay this invoice
        remaining -= invAmount;
      } else {
        // We are partially paying this invoice (e.g. paying 20 of 120)
        // We consume all our remaining money
        remaining = 0;
      }
    }
    setSelectedInvoiceIds(newSet);
    toast.info(`Auto-applied to ${newSet.size} invoices.`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTenant) return toast.error("Select a tenant");

    const formData = new FormData(e.currentTarget);
    formData.append("tenantId", String(selectedTenant.id));
    // Pass selected IDs as string
    formData.append(
      "selectedInvoices",
      Array.from(selectedInvoiceIds).join(","),
    );

    startTransition(async () => {
      const result = await createCustomerPayment(null, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment recorded successfully!");
        // Reset form or redirect
        router.push("/dashboard/reservations"); // or payments list
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Primary Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SearchableSelect
              label="Customer (Tenant)"
              options={tenantOptions}
              value={selectedTenant}
              onChange={setSelectedTenant}
              onAdd={() => setIsModalOpen(true)}
              placeholder="Select or add tenant..."
            />

            {/* Balance Badge */}
            {selectedTenant && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">Current Balance:</span>
                <span
                  className={`text-lg font-bold ${tenantBalance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {loadingFinancials
                    ? "..."
                    : `${tenantBalance.toFixed(3)} OMR`}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Date
              </label>
              <input
                type="date"
                name="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">
                Payment Amount (OMR)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  name="amount"
                  step="0.001"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(parseFloat(e.target.value) || 0)
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
                />
                <button
                  type="button"
                  onClick={handleAutoApply}
                  className="absolute right-2 top-1.5 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                >
                  Auto Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6"></div>

        {/* 2. Invoices List (The NetSuite Part) */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-gray-500" />
            Apply to Invoices
          </h3>

          {invoices.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-sm text-gray-500">
                {selectedTenant
                  ? "No open invoices found for this tenant."
                  : "Select a tenant to view open invoices."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Pay
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Unit
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900"
                    >
                      Orig. Amt.
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 pr-6"
                    >
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={
                        selectedInvoiceIds.has(inv.id) ? "bg-blue-50" : ""
                      }
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.has(inv.id)}
                          onChange={() =>
                            toggleInvoice(inv.id, Number(inv.amount))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {inv.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {inv.reservation?.unit?.name || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                        {Number(inv.amount).toFixed(3)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900 text-right pr-6">
                        {Number(inv.amount).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 px-6 text-right font-medium text-gray-900"
                    >
                      Total Applied:
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-blue-600">
                      {Array.from(selectedInvoiceIds)
                        .reduce((sum, id) => {
                          const inv = invoices.find((i) => i.id === id);
                          return sum + (inv ? Number(inv.amount) : 0);
                        }, 0)
                        .toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 px-6 text-right font-medium text-gray-500"
                    >
                      Unapplied (Credit):
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-gray-500">
                      {(
                        paymentAmount -
                        Array.from(selectedInvoiceIds).reduce((sum, id) => {
                          const inv = invoices.find((i) => i.id === id);
                          return sum + (inv ? Number(inv.amount) : 0);
                        }, 0)
                      ).toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* 3. Method & Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Payment Method
            </label>
            <select
              name="method"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 border"
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card / POS</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Reference / Check #
            </label>
            <input
              type="text"
              name="reference"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-sm font-medium text-gray-900">
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 border"
            ></textarea>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Processing..." : "Save Payment"}
          </button>
        </div>
      </form>

      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(t) => {
          setTenantOptions((prev) => [
            ...prev,
            { id: t.id, name: `${t.firstName} ${t.lastName}` },
          ]);
          setSelectedTenant({ id: t.id, name: `${t.firstName} ${t.lastName}` });
        }}
      />
    </>
  );
}
