import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/FormComponents";
import TenantForm from "@/components/dashboard/TenantForm";
import { assertCan } from "@/lib/access";
import { getAuthUser } from "@/lib/current-user";

export default async function NewTenantPage() {
  await assertCan("tenants", "CREATE");
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const t = await getTranslations("tenants.newPage");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref="/dashboard/tenants"
      />
      <TenantForm />
    </div>
  );
}
