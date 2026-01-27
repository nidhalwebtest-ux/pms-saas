import { createTenant } from "../actions";
import {
  PageHeader,
  FormCard,
  FormInput,
  FormActions,
} from "@/components/ui/FormComponents";

export default function NewTenantPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title="Add New Tenant"
        description="Add a new resident or guest to your directory."
      />

      <form action={createTenant}>
        <FormCard>
          {/* Personal Info */}
          <FormInput
            name="firstName"
            label="First Name"
            placeholder="e.g. Ahmed"
            required
            colSpan="sm:col-span-3"
          />
          <FormInput
            name="lastName"
            label="Last Name"
            placeholder="e.g. Al-Said"
            required
            colSpan="sm:col-span-3"
          />

          <FormInput
            name="phone"
            label="Phone Number"
            type="tel"
            placeholder="+968 9000 0000"
            required
            colSpan="sm:col-span-3"
          />
          <FormInput
            name="email"
            label="Email Address"
            type="email"
            placeholder="optional@email.com"
            colSpan="sm:col-span-3"
          />

          {/* Identity Section (Omani Context) */}
          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Identity Verification
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="nationalId"
                label="Civil ID / Passport No"
                placeholder="Number found on ID card"
                colSpan="sm:col-span-3"
              />
              <FormInput
                name="nationality"
                label="Nationality"
                placeholder="e.g. Omani"
                colSpan="sm:col-span-3"
              />
            </div>
          </div>
        </FormCard>

        <FormActions cancelHref="/dashboard/tenants" />
      </form>
    </div>
  );
}
