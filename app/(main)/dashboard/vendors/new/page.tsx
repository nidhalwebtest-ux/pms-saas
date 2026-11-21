import { assertCan } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/FormComponents";
import VendorForm from "@/components/dashboard/VendorForm";

export default async function NewVendorPage() {
  const access = await assertCan("vendors", "CREATE");
  const t = await getTranslations("vendors.newPage");

  const categories = await prisma.expenseCat.findMany({
    where: { organizationId: access.organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, nameAr: true },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref="/dashboard/vendors"
      />
      <VendorForm categories={categories} />
    </div>
  );
}
