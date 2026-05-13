"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
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
  UserIcon,
} from "@heroicons/react/24/outline";
import TenantForm from "@/components/dashboard/TenantForm";
import { Modal, ModalHeader, ModalBody } from "@/components/ui";

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
  const t       = useTranslations("payments.edit");
  const tMethod = useTranslations("payments.methods");
  const locale  = useLocale();
  const dfLoc   = locale === "ar" ? arLocale : enLocale;

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
      if (!selectedTenant?.id) return toast.error(t("selectTenant"));
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
          isEditMode ? t("updated") : t("recorded"),
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
              <UserIcon className="h-4 w-4" /> {t("paymentDetails")}
            </h3>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              {t("customer")}
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
                onAdd={() => setIsTenantModalOpen(true)}
              />
            )}
          </div>

          <FormInput
            name="amount"
            id="amount"
            label={t("amount")}
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
            label={t("method")}
            colSpan="sm:col-span-2"
            disabled={isEditMode} // Locked in edit mode
            defaultValue={initialData?.method || "BANK_TRANSFER"}
            options={[
              { label: tMethod("BANK_TRANSFER"), value: "BANK_TRANSFER" },
              { label: tMethod("CASH"),          value: "CASH" },
              { label: tMethod("CARD_CREDIT"),   value: "CARD" },
              { label: tMethod("CHEQUE"),        value: "CHEQUE" },
            ]}
          />

          {/* Row 2: Metadata (3 Columns) */}
          <div className="col-span-full pt-4 mt-2 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" /> {t("referenceDates")}
            </h3>
          </div>

          <FormInput
            name="date"
            label={t("date")}
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
            label={t("referenceCheque")}
            placeholder={t("referencePlaceholder")}
            defaultValue={initialData?.reference || ""}
            colSpan="sm:col-span-2"
          />

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              {t("memo")}
            </label>
            <input
              type="text"
              name="notes"
              defaultValue={initialData?.notes || ""}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder={t("memoPlaceholder")}
            />
          </div>

          {/* Dynamic Invoices Table (Only in Create Mode) */}
          {!isEditMode && selectedTenant && (
            <div className="col-span-full pt-6 mt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                <BanknotesIcon className="h-4 w-4" /> {t("openInvoices")}
              </h3>

              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                {isLoadingInvoices ? (
                  <div className="p-8 text-center text-sm text-gray-500 animate-pulse">
                    {t("checkingLedgers")}
                  </div>
                ) : openInvoices.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    {t("noOpenInvoicesCredit")}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-start text-xs font-semibold text-gray-900 w-12"
                        >
                          {t("apply")}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-start text-xs font-semibold text-gray-900"
                        >
                          {t("invoiceNo")}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-start text-xs font-semibold text-gray-900"
                        >
                          {t("dueDate")}
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-end text-xs font-semibold text-gray-900"
                        >
                          {t("amountDue")}
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
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 ltr-numbers">
                            {inv.invoiceNumber || `INV-${inv.id.slice(0, 6)}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 ltr-numbers">
                            {format(new Date(inv.dueDate), "dd/MM/yyyy", { locale: dfLoc })}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-end ltr-numbers">
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
          submitLabel={isEditMode ? t("updateBtn") : t("recordBtn")}
          isPending={isPending}
        />
      </form>
      <Modal
        open={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        size="lg"
        backdropBlur
      >
        <ModalHeader title={t("addQuickTenant")} />
        <ModalBody>
          <TenantForm
            onSuccess={(newTenant) => {
              const newOption = {
                id: newTenant.id,
                name: `${newTenant.firstName} ${newTenant.lastName}`,
              };
              setTenantOptions((prev) => [...prev, newOption]);
              setSelectedTenant(newOption);
              setIsTenantModalOpen(false);
            }}
          />
        </ModalBody>
      </Modal>
    </>
  );
}
