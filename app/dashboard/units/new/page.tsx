import {
  PageHeader,
  FormCard,
  FormInput,
  FormActions,
} from "@/components/ui/FormComponents";
import { createUnit } from "../../properties/[id]/actions";

export default async function NewUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title="Add New Unit / Room"
        description="Add a rentable unit to this property."
      />

      <form action={createUnit}>
        {/* Hidden Field must be inside the form */}
        <input type="hidden" name="propertyId" value={id} />

        <FormCard>
          {/* 1. Main Info */}
          <FormInput
            name="name"
            id="name"
            label="Unit Name / Number"
            placeholder="e.g. Room 101, Apt 4B"
            required
            colSpan="sm:col-span-3"
          />

          <FormInput
            name="basePrice"
            id="basePrice"
            label="Base Price (OMR)"
            type="number"
            step="0.01"
            placeholder="0.00"
            required
            colSpan="sm:col-span-3"
          />

          {/* 2. Details Row (Grouped visually by 3 columns) */}
          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Specs</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="floor"
                id="floor"
                label="Floor"
                type="number"
                defaultValue="1"
                colSpan="sm:col-span-2"
              />

              <FormInput
                name="bedrooms"
                id="bedrooms"
                label="Bedrooms"
                type="number"
                defaultValue="1"
                colSpan="sm:col-span-2"
              />

              <FormInput
                name="bathrooms"
                id="bathrooms"
                label="Bathrooms"
                type="number"
                defaultValue="1"
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
