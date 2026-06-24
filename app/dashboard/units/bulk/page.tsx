import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import BulkCreateForm from "./BulkCreateForm";
import { getTranslations } from "next-intl/server";
import { assertCan } from "@/lib/access";
import { getSelectedPropertyId } from "@/lib/selected-property";

export default async function BulkCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  await assertCan("units", "CREATE");
  const { propertyId } = await searchParams;
  const t = await getTranslations("units.bulk");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const properties = await prisma.property.findMany({
    where:   { organizationId: dbUser.organizationId, isArchived: false },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Default the target building to the explicit ?propertyId, else the globally
  // selected building (property view), else the first property.
  const selectedPropertyId = await getSelectedPropertyId();
  const validIds = new Set(properties.map((p) => p.id));
  const resolvedDefault =
    (propertyId && validIds.has(propertyId) && propertyId) ||
    (selectedPropertyId && validIds.has(selectedPropertyId) && selectedPropertyId) ||
    undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("description")}</p>
      </div>
      <BulkCreateForm properties={properties} defaultPropertyId={resolvedDefault} />
    </div>
  );
}
