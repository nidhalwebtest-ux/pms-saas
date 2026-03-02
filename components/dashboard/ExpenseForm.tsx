"use client";

import { useState, useTransition } from "react";
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
import { createExpense, updateExpense } from "@/app/dashboard/expenses/actions";
import {
  BuildingOfficeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

interface Props {
  properties: { id: string; name: string }[];
  initialData?: {
    id: string;
    title: string;
    amount: any;
    date: Date;
    category: string;
    propertyId: string;
  } | null;
}

export default function ExpenseForm({ properties, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;

  // Searchable Select State
  const propertyOptions: SelectOption[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const initialPropertyOption = isEditMode
    ? propertyOptions.find((p) => p.id === initialData.propertyId) || null
    : null;

  const [selectedProperty, setSelectedProperty] = useState<SelectOption | null>(
    initialPropertyOption,
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProperty?.id) return toast.error("Please select a Property.");

    const formData = new FormData(e.currentTarget);
    formData.append("propertyId", String(selectedProperty.id));

    startTransition(async () => {
      const result = isEditMode
        ? await updateExpense(formData)
        : await createExpense(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditMode
            ? "Expense updated successfully!"
            : "Expense recorded successfully!",
        );
        setTimeout(() => {
          // Redirect to view page
          router.push(`/dashboard/expenses/${result?.id || initialData?.id}`);
        }, 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}

      <FormCard>
        {/* Row 1: Classification (3 Columns) */}
        <div className="col-span-full mb-2 border-b border-gray-100 pb-2">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4" /> Classification
          </h3>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
            Select Property
          </label>
          <SearchableSelect
            label=""
            options={propertyOptions}
            value={selectedProperty}
            onChange={setSelectedProperty}
            placeholder="Search property..."
          />
        </div>

        <FormSelect
          name="category"
          label="Expense Category"
          colSpan="sm:col-span-2"
          defaultValue={initialData?.category || "MAINTENANCE"}
          options={[
            { label: "Utilities", value: "UTILITIES" },
            { label: "Maintenance", value: "MAINTENANCE" },
            { label: "Salary & Wages", value: "SALARY" },
            { label: "Marketing", value: "MARKETING" },
            { label: "Supplies", value: "SUPPLIES" },
            { label: "Other", value: "OTHER" },
          ]}
        />

        <FormInput
          name="date"
          label="Date Incurred"
          type="date"
          required
          defaultValue={
            initialData
              ? new Date(initialData.date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]
          }
          colSpan="sm:col-span-2"
        />

        {/* Row 2: Details (2 Columns spanning the 6-col grid) */}
        <div className="col-span-full pt-4 mt-2 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
            <DocumentTextIcon className="h-4 w-4" /> Expense Details
          </h3>
        </div>

        <FormInput
          name="title"
          id="title"
          label="Description / Title"
          placeholder="e.g. August Electricity Bill"
          required
          defaultValue={initialData?.title}
          colSpan="sm:col-span-4" // Takes up 2/3 of the row
        />

        <FormInput
          name="amount"
          id="amount"
          label="Amount"
          type="number"
          step="0.001"
          required
          placeholder="0.000"
          defaultValue={initialData ? Number(initialData.amount) : ""}
          colSpan="sm:col-span-2" // Takes up 1/3 of the row
          icon={<span className="text-gray-500 sm:text-sm font-bold">OMR</span>}
        />
      </FormCard>

      <FormActions
        cancelHref="/dashboard/expenses"
        submitLabel={isEditMode ? "Save Changes" : "Record Expense"}
        isPending={isPending}
      />
    </form>
  );
}
