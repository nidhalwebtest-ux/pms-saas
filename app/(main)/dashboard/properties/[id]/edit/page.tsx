import { PageHeader } from "@/components/ui/FormComponents";
import PropertyForm from "@/components/dashboard/PropertyForm";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuthUser } from "@/lib/current-user";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const property = await prisma.property.findUnique({
    where: { id },
  });

  if (!property || property.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  const t = await getTranslations("buildings.form");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("editTitle")}
        description={t("editDescription")}
      />

      {/* Render the form in Edit mode by passing initialData */}
      <PropertyForm initialData={property} />
    </div>
  );
}
