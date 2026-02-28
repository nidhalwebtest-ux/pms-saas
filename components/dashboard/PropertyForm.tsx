"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProperty,
  updateProperty,
} from "@/app/dashboard/properties/actions";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { BuildingOfficeIcon, MapPinIcon } from "@heroicons/react/24/outline";

// If initialData is passed, it's Edit Mode. If null, it's Create Mode.
interface Props {
  initialData?: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    city: string | null;
    governorate: string | null;
  } | null;
}

export default function PropertyForm({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      // Choose action based on mode
      const result = isEditMode
        ? await updateProperty(formData)
        : await createProperty(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditMode
            ? "Property updated successfully!"
            : "Property created successfully!",
        );
        setTimeout(() => {
          router.push(
            isEditMode
              ? `/dashboard/properties/${initialData.id}`
              : `/dashboard/properties/${result?.id}`,
          );
        }, 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Hidden ID field required for Edit Mode */}
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}

      <FormCard>
        {/* Row 1: 3 Columns */}
        <div className="col-span-full mb-2">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2 border-b border-gray-100 pb-2">
            <BuildingOfficeIcon className="h-4 w-4" /> Primary Information
          </h3>
        </div>

        <FormInput
          name="name"
          id="name"
          label="Property Name"
          placeholder="e.g. Salalah Gardens Resort"
          required
          defaultValue={initialData?.name}
          colSpan="sm:col-span-2" // 1/3 of the row
        />

        <FormSelect
          name="type"
          id="type"
          label="Property Type"
          colSpan="sm:col-span-2" // 1/3 of the row
          defaultValue={initialData?.type || "RESIDENTIAL"}
          options={[
            { label: "Residential (Apartments/Villas)", value: "RESIDENTIAL" },
            { label: "Hotel", value: "HOTEL" },
            { label: "Commercial", value: "COMMERCIAL" },
          ]}
        />

        {/* Empty div to keep the 3-column grid perfectly aligned if we only have 2 inputs in this section */}
        <div className="sm:col-span-2 hidden sm:block"></div>

        {/* Row 2: Location (3 Columns) */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <MapPinIcon className="h-4 w-4" /> Location Details
          </h3>
        </div>

        <FormInput
          name="address"
          id="address"
          label="Street Address"
          placeholder="Building No, Street Name..."
          defaultValue={initialData?.address || ""}
          colSpan="sm:col-span-2" // 1/3
        />

        <FormInput
          name="city"
          id="city"
          label="City / Wilayat"
          defaultValue={initialData?.city || "Salalah"}
          colSpan="sm:col-span-2" // 1/3
        />

        <FormInput
          name="governorate"
          id="governorate"
          label="Governorate"
          defaultValue={initialData?.governorate || "Dhofar"}
          colSpan="sm:col-span-2" // 1/3
        />
      </FormCard>

      <FormActions
        cancelHref={
          isEditMode
            ? `/dashboard/properties/${initialData.id}`
            : "/dashboard/properties"
        }
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Property"}
      />
    </form>
  );
}
