import { createProperty } from "../actions";
import {
  PageHeader,
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { BuildingOfficeIcon, MapPinIcon } from "@heroicons/react/24/outline";

export default function NewPropertyPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <PageHeader
        title="Add New Property"
        description="Enter the details of the building, hotel, or compound."
      />

      <form action={createProperty}>
        <FormCard>
          {/* 1. Basic Info */}
          <FormInput
            name="name"
            id="name"
            label="Property Name"
            placeholder="e.g. Salalah Gardens Resort"
            required
            colSpan="sm:col-span-4"
            icon={<BuildingOfficeIcon className="h-5 w-5 text-gray-400" />}
          />

          <FormSelect
            name="type"
            id="type"
            label="Property Type"
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

          {/* 2. Location (Grouped visually) */}
          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <MapPinIcon className="h-4 w-4" /> Location Details
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="address"
                id="address"
                label="Street Address"
                placeholder="Building No, Street Name..."
                colSpan="col-span-full"
              />

              <FormInput
                name="city"
                id="city"
                label="City / Wilayat"
                defaultValue="Salalah"
                colSpan="sm:col-span-3"
              />

              <FormInput
                name="governorate"
                id="governorate"
                label="Governorate"
                defaultValue="Dhofar"
                colSpan="sm:col-span-3"
              />
            </div>
          </div>
        </FormCard>

        <FormActions
          cancelHref="/dashboard/properties"
          submitLabel="Save Property"
        />
      </form>
    </div>
  );
}
