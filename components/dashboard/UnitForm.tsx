"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUnit, updateUnit } from "@/app/dashboard/units/actions";
import { FormCard, FormInput, FormSelect, FormActions } from "@/components/ui/FormComponents";
import {
  HomeModernIcon,
  AdjustmentsHorizontalIcon,
  PhotoIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import PhotoUpload from "@/components/dashboard/PhotoUpload";

interface Props {
  properties: { id: string; name: string }[];
  initialData?: {
    id: string;
    propertyId: string;
    name: string;
    basePrice: any;
    floor: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    status: string;
    photos: string[];
  } | null;
  defaultPropertyId?: string;
}

export default function UnitForm({ properties, initialData, defaultPropertyId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"AVAILABLE" | "MAINTENANCE">(
    (initialData?.status as any) ?? "AVAILABLE",
  );

  const isEditMode = !!initialData;
  const propertyOptions = properties.map((p) => ({ label: p.name, value: p.id }));
  const storageFolder = `units/${initialData?.id ?? crypto.randomUUID()}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditMode ? await updateUnit(formData) : await createUnit(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditMode ? "Unit updated!" : "Unit created!");
        setTimeout(() => router.push("/dashboard/units"), 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}
      {/* Status is carried as a hidden field, updated by the toggle */}
      <input type="hidden" name="status" value={status} />

      <FormCard>
        {/* ── Section: Primary Info ─────────────────────────────── */}
        <div className="col-span-full mb-2">
          <h3 className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-medium text-gray-500">
            <HomeModernIcon className="h-4 w-4" /> Primary Information
          </h3>
        </div>

        <FormSelect
          name="propertyId"
          id="propertyId"
          label="Property"
          colSpan="sm:col-span-2"
          required
          defaultValue={initialData?.propertyId || defaultPropertyId || ""}
          options={[{ label: "Choose a property…", value: "" }, ...propertyOptions]}
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
          label="Base Price (OMR)"
          type="number"
          step="0.001"
          min="0"
          placeholder="0.000"
          required
          defaultValue={initialData ? Number(initialData.basePrice).toFixed(3) : ""}
          colSpan="sm:col-span-2"
          icon={<span className="text-gray-500 sm:text-sm font-bold">OMR</span>}
        />

        {/* ── Maintenance status toggle ────────────────────────── */}
        <div className="col-span-full flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={status === "AVAILABLE"}
            onClick={() =>
              setStatus((s) => (s === "AVAILABLE" ? "MAINTENANCE" : "AVAILABLE"))
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              status === "AVAILABLE" ? "bg-green-500" : "bg-amber-400"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                status === "AVAILABLE" ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            {status === "AVAILABLE" ? (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Available — can accept reservations</span>
              </>
            ) : (
              <>
                <WrenchScrewdriverIcon className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Under Maintenance — blocked for booking</span>
              </>
            )}
          </div>
        </div>

        {/* ── Section: Specifications ───────────────────────────── */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-medium text-gray-500">
            <AdjustmentsHorizontalIcon className="h-4 w-4" /> Specifications
          </h3>
        </div>

        <FormInput
          name="floor"
          id="floor"
          label="Floor"
          type="number"
          min="0"
          defaultValue={initialData?.floor ?? 1}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="bedrooms"
          id="bedrooms"
          label="Bedrooms"
          type="number"
          min="0"
          defaultValue={initialData?.bedrooms ?? 1}
          colSpan="sm:col-span-2"
        />

        <FormInput
          name="bathrooms"
          id="bathrooms"
          label="Bathrooms"
          type="number"
          min="0"
          defaultValue={initialData?.bathrooms ?? 1}
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
        cancelHref="/dashboard/units"
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Unit"}
      />
    </form>
  );
}