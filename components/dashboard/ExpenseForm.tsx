"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import SearchableSelect, {
  SelectOption,
} from "@/components/ui/SearchableSelect"; // Reusing your component
import {
  BanknotesIcon,
  CalendarDaysIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { createExpense } from "@/app/dashboard/expenses/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  properties: { id: string; name: string }[];
}

export default function ExpenseForm({ properties }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Convert properties to SelectOption format
  const propertyOptions: SelectOption[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const [selectedProperty, setSelectedProperty] = useState<SelectOption | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProperty) return toast.error("Select a Property");

    const formData = new FormData(e.currentTarget);
    formData.append("propertyId", String(selectedProperty.id));

    startTransition(async () => {
      const result = await createExpense(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Expense recorded successfully!");
        // Reset form or redirect
        setTimeout(() => {
          router.push("/dashboard/expenses");
        }, 3000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Property Selection */}
      <div>
        <SearchableSelect
          label="Select Property"
          options={propertyOptions}
          value={selectedProperty}
          onChange={setSelectedProperty}
          placeholder="Search property..."
        />
        {/* Hidden Input to send ID to Server Action */}
        <input
          type="hidden"
          name="propertyId"
          value={selectedProperty?.id || ""}
        />
      </div>

      <div className="border-t border-gray-100 pt-6"></div>

      {/* 2. Expense Details */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Description
        </label>
        <div className="mt-2 relative rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <TagIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            name="title"
            id="title"
            required
            placeholder="e.g. August Electricity Bill"
            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        {/* Category */}
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium leading-6 text-gray-900"
          >
            Category
          </label>
          <div className="mt-2">
            <select
              id="category"
              name="category"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="UTILITIES">Utilities</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="SALARY">Salary & Wages</option>
              <option value="MARKETING">Marketing</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium leading-6 text-gray-900"
          >
            Date
          </label>
          <div className="mt-2 relative rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CalendarDaysIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="date"
              name="date"
              id="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>
      </div>

      {/* Amount (Big Input) */}
      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Amount
        </label>
        <div className="mt-2 relative rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 sm:text-sm">OMR</span>
          </div>
          <input
            type="number"
            name="amount"
            id="amount"
            step="0.001"
            required
            placeholder="0.000"
            className="block w-full rounded-md border-0 py-3 pl-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-lg font-semibold"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-6 flex items-center justify-end gap-x-6 border-t border-gray-100">
        <Link
          href="/dashboard/expenses"
          className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-8 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save Expense"}
        </button>
      </div>
    </form>
  );
}
