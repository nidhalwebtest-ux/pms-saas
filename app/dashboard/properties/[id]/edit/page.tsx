import { updateProperty } from "../../actions";
import {
  PageHeader,
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const prisma = new PrismaClient();

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch Existing Data
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const property = await prisma.property.findUnique({
    where: { id },
  });

  // 2. Security Check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!property || property.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title={`Edit ${property.name}`}
        description="Update property details and location."
      />

      <form action={updateProperty}>
        <input type="hidden" name="id" value={property.id} />

        <FormCard>
          <FormInput
            name="name"
            id="name"
            label="Property Name"
            defaultValue={property.name}
            required
            colSpan="sm:col-span-4"
          />

          <FormSelect
            name="type"
            id="type"
            label="Property Type"
            defaultValue={property.type}
            colSpan="sm:col-span-3"
            options={[
              {
                label: "Residential (Apartments/Villas)",
                value: "RESIDENTIAL",
              },
              { label: "Hotel", value: "HOTEL" },
              { label: "Commercial", value: "COMMERCIAL" },
            ]}
          />

          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Location Details
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="address"
                id="address"
                label="Street Address"
                defaultValue={property.address || ""}
                colSpan="col-span-full"
              />

              <FormInput
                name="city"
                id="city"
                label="City / Wilayat"
                defaultValue={property.city}
                colSpan="sm:col-span-3"
              />

              <FormInput
                name="governorate"
                id="governorate"
                label="Governorate"
                defaultValue={property.governorate}
                colSpan="sm:col-span-3"
              />
            </div>
          </div>
        </FormCard>

        <FormActions cancelHref={`/dashboard/properties/${id}`} />
      </form>
    </div>
  );
}
