import SlideOver from "@/components/ui/SlideOver";
import { createProperty } from "@/app/dashboard/properties/actions";
import {
  PageHeader,
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";

export default function InterceptedNewPropertyPage() {
  return (
    <SlideOver title="Add New Property">
      <div className="pb-10">
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
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                Location Details
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

          <FormActions cancelHref="/dashboard/properties" />
        </form>
      </div>
    </SlideOver>
  );
}
