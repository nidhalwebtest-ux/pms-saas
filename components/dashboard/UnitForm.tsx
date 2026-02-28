"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUnit, updateUnit } from "@/app/dashboard/units/actions";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import {
  HomeModernIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

interface Props {
  properties: { id: string; name: string }[];
  initialData?: {
    id: string;
    propertyId: string;
    name: string;
    basePrice: any; // Decimal from Prisma
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
  } | null;
  defaultPropertyId?: string; // If coming from a specific property page
}

export default function UnitForm({
  properties,
  initialData,
  defaultPropertyId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;
  const propertyOptions = properties.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditMode
        ? await updateUnit(formData)
        : await createUnit(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditMode
            ? "Unit updated successfully!"
            : "Unit created successfully!",
        );
        setTimeout(() => {
          // Redirect to the unit's view page (or list if you prefer)
          router.push(`/dashboard/units`);
        }, 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}

      <FormCard>
        {/* Row 1: Primary Info (3 Columns) */}
        <div className="col-span-full mb-2">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2 border-b border-gray-100 pb-2">
            <HomeModernIcon className="h-4 w-4" /> Primary Information
          </h3>
        </div>

        <FormSelect
          name="propertyId"
          id="propertyId"
          label="Select Property"
          colSpan="sm:col-span-2"
          required
          defaultValue={initialData?.propertyId || defaultPropertyId || ""}
          options={[
            { label: "Choose a property...", value: "" },
            ...propertyOptions,
          ]}
        />

        <FormInput
          name="name"
          id="name"
          label="Unit Name / Number"
          placeholder="e.g. Room 101, Apt 4B"
          required
          defaultValue={initialData?.name}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="basePrice"
          id="basePrice"
          label="Base Price"
          type="number"
          step="0.001"
          placeholder="0.000"
          required
          defaultValue={initialData ? Number(initialData.basePrice) : ""}
          colSpan="sm:col-span-2"
          icon={<span className="text-gray-500 sm:text-sm font-bold">OMR</span>}
        />

        {/* Row 2: Specs (3 Columns) */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <AdjustmentsHorizontalIcon className="h-4 w-4" /> Specifications
          </h3>
        </div>

        <FormInput
          name="floor"
          id="floor"
          label="Floor"
          type="number"
          defaultValue={initialData?.floor || 1}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="bedrooms"
          id="bedrooms"
          label="Bedrooms"
          type="number"
          defaultValue={initialData?.bedrooms || 1}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="bathrooms"
          id="bathrooms"
          label="Bathrooms"
          type="number"
          defaultValue={initialData?.bathrooms || 1}
          colSpan="sm:col-span-2"
        />
      </FormCard>

      <FormActions
        cancelHref="/dashboard/units"
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Unit"}
      />
    </form>
  );
}
