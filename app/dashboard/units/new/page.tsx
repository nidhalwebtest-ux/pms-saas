import { PageHeader } from "@/components/ui/FormComponents";
import UnitForm from "@/components/dashboard/UnitForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { assertCan } from "@/lib/access";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getSessionAccessibleProperties } from "@/lib/property-scope";

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  await assertCan("units", "CREATE");
  const { propertyId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Restrict the building dropdown to the user's accessible buildings.
  const accessible = await getSessionAccessibleProperties();
  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId!, ...(accessible ? { id: { in: accessible } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Default the building to the explicit param, else the sidebar-selected one.
  const selected = await getSelectedPropertyId();
  const defaultPropertyId =
    (propertyId && properties.some((p) => p.id === propertyId) && propertyId) ||
    (selected && properties.some((p) => p.id === selected) && selected) ||
    undefined;

  const t = await getTranslations("units.newPage");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        listHref="/dashboard/units"
      />
      <UnitForm properties={properties} defaultPropertyId={defaultPropertyId} />
    </div>
  );
}
