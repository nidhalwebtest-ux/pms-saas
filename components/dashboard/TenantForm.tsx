"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTenant, updateTenant } from "@/app/dashboard/tenants/actions";
import {
  FormCard,
  FormInput,
  FormActions,
} from "@/components/ui/FormComponents";
import {
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

interface Props {
  initialData?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    nationalId: string | null;
    nationality: string | null;
  } | null;

  onSuccess?: (tenant: {
    id: string;
    firstName: string;
    lastName: string;
  }) => void;
}

export default function TenantForm({ initialData, onSuccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEditMode = !!initialData;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditMode
        ? await updateTenant(formData)
        : await createTenant(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditMode
            ? "Tenant updated successfully!"
            : "Tenant created successfully!",
        );
        if (onSuccess && result.id) {
          onSuccess({
            id: result.id,
            firstName: formData.get("firstName") as string,
            lastName: formData.get("lastName") as string,
          });
          return; // Stop execution so we don't redirect
        }
        setTimeout(() => {
          // Redirect to the View page
          router.push(`/dashboard/tenants/${result?.id}`);
        }, 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {isEditMode && <input type="hidden" name="id" value={initialData.id} />}

      <FormCard>
        {/* Row 1 & 2: Personal Info (3 Columns) */}
        <div className="col-span-full mb-2">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2 border-b border-gray-100 pb-2">
            <UserIcon className="h-4 w-4" /> Personal Information
          </h3>
        </div>

        <FormInput
          name="firstName"
          label="First Name"
          placeholder="e.g. Ahmed"
          required
          defaultValue={initialData?.firstName}
          colSpan="sm:col-span-2" // 1/3
        />

        <FormInput
          name="lastName"
          label="Last Name"
          placeholder="e.g. Al-Said"
          required
          defaultValue={initialData?.lastName}
          colSpan="sm:col-span-2" // 1/3
        />

        <FormInput
          name="phone"
          label="Phone Number"
          type="tel"
          placeholder="+968 9000 0000"
          required
          defaultValue={initialData?.phone}
          colSpan="sm:col-span-2" // 1/3
          icon={<PhoneIcon className="h-5 w-5 text-gray-400" />}
        />

        <FormInput
          name="email"
          label="Email Address"
          type="email"
          placeholder="optional@email.com"
          defaultValue={initialData?.email || ""}
          colSpan="sm:col-span-2" // 1/3
          icon={<EnvelopeIcon className="h-5 w-5 text-gray-400" />}
        />

        {/* Empty div to balance the grid row */}
        <div className="sm:col-span-4 hidden sm:block"></div>

        {/* Row 3: Identity Verification (3 Columns) */}
        <div className="col-span-full pt-4 mt-2">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2 border-b border-gray-100 pb-2">
            <IdentificationIcon className="h-4 w-4" /> Identity Verification
          </h3>
        </div>

        <FormInput
          name="nationalId"
          label="Civil ID / Passport No"
          placeholder="Number found on ID card"
          defaultValue={initialData?.nationalId || ""}
          colSpan="sm:col-span-2" // 1/3
        />

        <FormInput
          name="nationality"
          label="Nationality"
          placeholder="e.g. Omani"
          defaultValue={initialData?.nationality || ""}
          colSpan="sm:col-span-2" // 1/3
          icon={<GlobeAltIcon className="h-5 w-5 text-gray-400" />}
        />
      </FormCard>

      <FormActions
        cancelHref={
          isEditMode
            ? `/dashboard/tenants/${initialData.id}`
            : "/dashboard/tenants"
        }
        isPending={isPending}
        submitLabel={isEditMode ? "Save Changes" : "Create Tenant"}
      />
    </form>
  );
}
