"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProperty, updateProperty } from "@/app/dashboard/properties/actions";
import { FormCard, FormInput, FormSelect, FormActions } from "@/components/ui/FormComponents";
import {
  BuildingOfficeIcon,
  MapPinIcon,
  PhotoIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import PhotoUpload from "@/components/dashboard/PhotoUpload";

interface Props {
  initialData?: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    city: string | null;
    governorate: string | null;
    isActive: boolean;
    photos: string[];
  } | null;
}

export default function PropertyForm({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const isEditMode = !!initialData;
  // Folder for Supabase Storage: reuse existing ID or generate a temp one
  const storageFolder = `properties/${initialData?.id ?? crypto.randomUUID()}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditMode
        ? await updateProperty(formData)
        : await createProperty(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Property updated!" : "Property created!");
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
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}
      {/* Carry isActive as a hidden field — updated by the toggle below */}
      <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />

      <FormCard>
        {/* ── Section: Primary Info ─────────────────────────────── */}
        <div className="col-span-full mb-2">
          <h3 className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-medium text-gray-500">
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
          colSpan="sm:col-span-2"
        />

        <FormSelect
          name="type"
          id="type"
          label="Property Type"
          colSpan="sm:col-span-2"
          defaultValue={initialData?.type || "RESIDENTIAL"}
          options={[
            { label: "Residential (Apartments / Villas)", value: "RESIDENTIAL" },
            { label: "Hotel", value: "HOTEL" },
            { label: "Commercial", value: "COMMERCIAL" },
          ]}
        />

        {/* Active / Inactive toggle */}
        <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isActive ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            {isActive ? (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Active — accepting reservations</span>
              </>
            ) : (
              <>
                <WrenchScrewdriverIcon className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Inactive — hidden from booking</span>
              </>
            )}
          </div>
        </div>

        {/* ── Section: Location ─────────────────────────────────── */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-medium text-gray-500">
            <MapPinIcon className="h-4 w-4" /> Location Details
          </h3>
        </div>

        <FormInput
          name="address"
          id="address"
          label="Street Address"
          placeholder="Building No, Street Name…"
          defaultValue={initialData?.address || ""}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="city"
          id="city"
          label="City / Wilayat"
          defaultValue={initialData?.city || "Salalah"}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="governorate"
          id="governorate"
          label="Governorate"
          defaultValue={initialData?.governorate || "Dhofar"}
          colSpan="sm:col-span-2"
        />

        {/* ── Section: Photos ───────────────────────────────────── */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-medium text-gray-500">
            <PhotoIcon className="h-4 w-4" /> Photos
          </h3>
        </div>

        <PhotoUpload
          initialPhotos={initialData?.photos ?? []}
          folder={storageFolder}
          name="photos"
        />
      </FormCard>

      <FormActions
        cancelHref={
          isEditMode ? `/dashboard/properties/${initialData.id}` : "/dashboard/properties"
        }
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Property"}
      />
    </form>
  );
}