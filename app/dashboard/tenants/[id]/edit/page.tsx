import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/FormComponents";
import TenantForm from "@/components/dashboard/TenantForm";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const tenant = await prisma.tenant.findUnique({ where: { id } });

  if (!tenant || tenant.organizationId !== dbUser?.organizationId) {
    return notFound();
  }

  // Serialize dates to strings for client component
  const initialData = {
    ...tenant,
    dateOfBirth:   tenant.dateOfBirth   ? tenant.dateOfBirth.toISOString().split("T")[0]   : null,
    idExpiryDate:  tenant.idExpiryDate  ? tenant.idExpiryDate.toISOString().split("T")[0]  : null,
    createdAt:     tenant.createdAt.toISOString(),
    updatedAt:     tenant.updatedAt.toISOString(),
    firstStayDate: tenant.firstStayDate ? tenant.firstStayDate.toISOString() : null,
    lastStayDate:  tenant.lastStayDate  ? tenant.lastStayDate.toISOString()  : null,
    totalSpent:    tenant.totalSpent?.toString() ?? "0",
  };

  const t = await getTranslations("tenants.editPage");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref={`/dashboard/tenants/${id}`}
      />
      <TenantForm initialData={initialData as any} />
    </div>
  );
}
