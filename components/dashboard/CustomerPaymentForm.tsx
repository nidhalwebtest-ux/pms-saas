"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SearchableSelect, {
  SelectOption,
} from "@/components/ui/SearchableSelect";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import {
  createCustomerPayment,
  updateCustomerPayment,
  getTenantFinancials,
} from "@/app/dashboard/payments/actions";
import {
  BanknotesIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import TenantForm from "@/components/dashboard/TenantForm";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Props {
  tenants: { id: string; firstName: string; lastName: string }[];
  initialData?: {
    id: string;
    tenantId: string;
    amount: any;
    method: string;
    date: Date;
    reference: string | null;
    notes: string | null;
    tenant: { firstName: string; lastName: string };
  } | null;
}

export default function CustomerPaymentForm({ tenants, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;

  // State
  const [tenantOptions, setTenantOptions] = useState<SelectOption[]>(
    tenants.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` })),
  );

  const initialTenantOption = isEditMode
    ? {
        id: initialData.tenantId,
        name: `${initialData.tenant.firstName} ${initialData.tenant.lastName}`,
      }
    : null;

  const [selectedTenant, setSelectedTenant] = useState<SelectOption | null>(
    initialTenantOption,
  );
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<string>(
    isEditMode ? Number(initialData.amount).toString() : "",
  );

  // NEW: State for Tenant Modal
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);

  // Fetch invoices when tenant changes (Only in Create mode)
  useEffect(() => {
    if (isEditMode) return; // Don't fetch invoices if editing a locked payment
    if (!selectedTenant?.id) {
      setOpenInvoices([]);
      return;
    }

    setIsLoadingInvoices(true);
    getTenantFinancials(String(selectedTenant.id)).then((res) => {
      setOpenInvoices(res.invoices);
      setIsLoadingInvoices(false);
    });
  }, [selectedTenant, isEditMode]);

  const toggleInvoice = (id: string, invoiceAmount: number) => {
    setSelectedInvoiceIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      } else {
        // Optional UX trick: Auto-fill the payment amount to match the selected invoice
        if (!amount || parseFloat(amount) === 0) {
          setAmount(invoiceAmount.toString());
        }
        return [...prev, id];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!isEditMode) {
      if (!selectedTenant?.id) return toast.error("Please select a tenant.");
      formData.append("tenantId", String(selectedTenant.id));
      formData.append("selectedInvoices", selectedInvoiceIds.join(","));
    }

    startTransition(async () => {
      const result = isEditMode
        ? await updateCustomerPayment(formData)
        : await createCustomerPayment(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditMode
            ? "Payment record updated!"
            : "Payment successfully recorded!",
        );
        setTimeout(() => {
          router.push(`/dashboard/payments/${result?.id || initialData?.id}`);
        }, 1000);
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        {isEditMode && <input type="hidden" name="id" value={initialData.id} />}

        <FormCard>
          {/* Row 1: Primary Info (3 Columns) */}
          <div className="col-span-full mb-2 border-b border-gray-100 pb-2">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Payment Details
            </h3>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              Customer / Tenant
            </label>
            {isEditMode ? (
              <div className="block w-full rounded-md border-0 py-1.5 px-3 bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-300 sm:text-sm sm:leading-6">
                {initialTenantOption?.name}
              </div>
            ) : (
              <SearchableSelect
                label=""
                options={tenantOptions}
                value={selectedTenant}
                onChange={setSelectedTenant}
                onAdd={() => setIsTenantModalOpen(true)} // <-- 1. ADD THIS PROP
              />
            )}
          </div>

          <FormInput
            name="amount"
            id="amount"
            label="Payment Amount"
            type="number"
            step="0.001"
            required
            disabled={isEditMode} // Locked in edit mode
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            colSpan="sm:col-span-2"
            icon={
              <span className="text-gray-500 sm:text-sm font-bold">OMR</span>
            }
          />

          <FormSelect
            name="method"
            label="Payment Method"
            colSpan="sm:col-span-2"
            disabled={isEditMode} // Locked in edit mode
            defaultValue={initialData?.method || "BANK_TRANSFER"}
            options={[
              { label: "Bank Transfer", value: "BANK_TRANSFER" },
              { label: "Cash", value: "CASH" },
              { label: "Credit Card / POS", value: "CARD" },
              { label: "Cheque", value: "CHEQUE" },
            ]}
          />

          {/* Row 2: Metadata (3 Columns) */}
          <div className="col-span-full pt-4 mt-2 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" /> Reference & Dates
            </h3>
          </div>

          <FormInput
            name="date"
            label="Payment Date"
            type="date"
            required
            defaultValue={
              initialData
                ? new Date(initialData.date).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0]
            }
            colSpan="sm:col-span-2"
          />

          <FormInput
            name="reference"
            label="Reference / Cheque No."
            placeholder="e.g. TRN-998123"
            defaultValue={initialData?.reference || ""}
            colSpan="sm:col-span-2"
          />

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              Memo / Notes
            </label>
            <input
              type="text"
              name="notes"
              defaultValue={initialData?.notes || ""}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Optional notes..."
            />
          </div>

          {/* Dynamic Invoices Table (Only in Create Mode) */}
          {!isEditMode && selectedTenant && (
            <div className="col-span-full pt-6 mt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                <BanknotesIcon className="h-4 w-4" /> Open Invoices to Apply
                Against
              </h3>

              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                {isLoadingInvoices ? (
                  <div className="p-8 text-center text-sm text-gray-500 animate-pulse">
                    Checking ledgers...
                  </div>
                ) : openInvoices.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    No open invoices found. This will be recorded as an
                    unapplied credit.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-900 w-12"
                        >
                          Apply
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-900"
                        >
                          Invoice No.
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-900"
                        >
                          Due Date
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-semibold text-gray-900"
                        >
                          Amount Due
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {openInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-blue-50/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.includes(inv.id)}
                              onChange={() => toggleInvoice(inv.id, inv.amount)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {inv.invoiceNumber || `INV-${inv.id.slice(0, 6)}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                            {inv.amount.toFixed(3)} OMR
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </FormCard>

        <FormActions
          cancelHref="/dashboard/payments"
          submitLabel={isEditMode ? "Update Payment Record" : "Record Payment"}
          isPending={isPending}
        />
      </form>
      {isTenantModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in duration-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-gray-900">
                Add Quick Tenant
              </h2>
              <button
                onClick={() => setIsTenantModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <TenantForm
                onSuccess={(newTenant) => {
                  const newOption = {
                    id: newTenant.id,
                    name: `${newTenant.firstName} ${newTenant.lastName}`,
                  };
                  setTenantOptions((prev) => [...prev, newOption]); // Add to dropdown list
                  setSelectedTenant(newOption); // Auto-select it
                  setIsTenantModalOpen(false); // Close the modal
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
