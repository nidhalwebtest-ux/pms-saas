import { updateTenant } from "../../actions";
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

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Verify
  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title="Edit Tenant"
        description="Update contact or identity information."
      />

      <form action={updateTenant}>
        <input type="hidden" name="id" value={tenant.id} />

        <FormCard>
          <FormInput
            name="firstName"
            label="First Name"
            defaultValue={tenant.firstName}
            required
            colSpan="sm:col-span-3"
          />
          <FormInput
            name="lastName"
            label="Last Name"
            defaultValue={tenant.lastName}
            required
            colSpan="sm:col-span-3"
          />

          <FormInput
            name="phone"
            label="Phone Number"
            defaultValue={tenant.phone}
            required
            colSpan="sm:col-span-3"
          />
          <FormInput
            name="email"
            label="Email Address"
            defaultValue={tenant.email || ""}
            colSpan="sm:col-span-3"
          />

          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Identity Verification
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <FormInput
                name="nationalId"
                label="Civil ID / Passport No"
                defaultValue={tenant.nationalId || ""}
                colSpan="sm:col-span-3"
              />
              <FormInput
                name="nationality"
                label="Nationality"
                defaultValue={tenant.nationality || ""}
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
