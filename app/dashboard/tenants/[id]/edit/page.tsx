import { PageHeader } from "@/components/ui/FormComponents";
import TenantForm from "@/components/dashboard/TenantForm";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const tenant = await prisma.tenant.findUnique({ where: { id } });

  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Edit Tenant"
        description="Update contact or identity information."
        listHref="/dashboard/tenants"
      />
      <TenantForm initialData={tenant} />
    </div>
  );
}
