import { updateUnit } from "../../../actions"; // Adjust path to point to your actions file
import {
  PageHeader,
  FormCard,
  FormInput,
  FormActions,
} from "@/components/ui/FormComponents";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const prisma = new PrismaClient();

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const { id, unitId } = await params;

  // 1. Fetch Data
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: true },
  });

  // 2. Security Check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Ensure unit exists, belongs to property in URL, AND belongs to user's Org
  if (
    !unit ||
    unit.propertyId !== id ||
    unit.property.organizationId !== dbUser?.organizationId
  ) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title={`Edit ${unit.name}`}
        description={`Update details for unit in ${unit.property.name}`}
      />

      <form action={updateUnit}>
        <input type="hidden" name="unitId" value={unit.id} />
        <input type="hidden" name="propertyId" value={unit.propertyId} />

        <FormCard>
          <FormInput
            name="name"
            id="name"
            label="Unit Name / Number"
            defaultValue={unit.name}
            required
            colSpan="sm:col-span-3"
          />

          <FormInput
            name="basePrice"
            id="basePrice"
            label="Base Price (OMR)"
            type="number"
            step="0.01"
            defaultValue={Number(unit.basePrice)}
            required
            colSpan="sm:col-span-3"
          />

          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Specs</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="floor"
                id="floor"
                label="Floor"
                type="number"
                defaultValue={unit.floor}
                colSpan="sm:col-span-2"
              />

              <FormInput
                name="bedrooms"
                id="bedrooms"
                label="Bedrooms"
                type="number"
                defaultValue={unit.bedrooms}
                colSpan="sm:col-span-2"
              />

              <FormInput
                name="bathrooms"
                id="bathrooms"
                label="Bathrooms"
                type="number"
                defaultValue={unit.bathrooms}
                colSpan="sm:col-span-2"
              />
            </div>
          </div>
        </FormCard>

        <FormActions cancelHref={`/dashboard/properties/${id}`} />
      </form>
    </div>
  );
}
