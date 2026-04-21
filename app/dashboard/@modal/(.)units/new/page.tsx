import { getTranslations } from "next-intl/server";
import SlideOver from "@/components/ui/SlideOver";
import UnitForm from "@/components/dashboard/UnitForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function InterceptedNewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
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

  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const t = await getTranslations("dashboard.modals");

  return (
    <SlideOver title={t("addNewUnit")}>
      <div className="pb-10 px-2 sm:px-4">
        <UnitForm properties={properties} defaultPropertyId={propertyId} />
      </div>
    </SlideOver>
  );
}
