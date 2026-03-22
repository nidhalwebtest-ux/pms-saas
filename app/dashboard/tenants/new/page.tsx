import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PageHeader } from "@/components/ui/FormComponents";
import TenantForm from "@/components/dashboard/TenantForm";

export default async function NewTenantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Add New Tenant"
        description="Add a new resident or guest to your directory."
        listHref="/dashboard/tenants"
      />
      <TenantForm />
    </div>
  );
}
