import { notFound } from "next/navigation";
import { assertCan } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/FormComponents";
import VendorForm from "@/components/dashboard/VendorForm";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await assertCan("vendors", "EDIT");
  const t = await getTranslations("vendors.editPage");

  const [vendor, categories] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true, name: true, nameAr: true, categoryId: true,
        contactPerson: true, phone: true, email: true, address: true,
        notes: true, taxNumber: true, bankAccountName: true, bankName: true,
        accountNumber: true, organizationId: true,
      },
    }),
    prisma.expenseCat.findMany({
      where: { organizationId: access.organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameAr: true },
    }),
  ]);

  if (!vendor || vendor.organizationId !== access.organizationId) notFound();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref="/dashboard/vendors"
      />
      <VendorForm initialData={vendor} categories={categories} />
    </div>
  );
}
