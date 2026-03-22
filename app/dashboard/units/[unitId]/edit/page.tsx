import { PageHeader } from "@/components/ui/FormComponents";
import UnitForm from "@/components/dashboard/UnitForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { organizationId: true, name: true } } },
  });

  if (!unit || unit.property.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  // All org-scoped properties for the property selector
  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser!.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title={`Edit ${unit.name}`}
        description={`Update details for unit in ${unit.property.name}`}
      />
      <UnitForm
        properties={properties}
        initialData={{
          id:          unit.id,
          propertyId:  unit.propertyId,
          name:        unit.name,
          basePrice:   unit.basePrice,
          unitType:    unit.unitType,
          floor:       unit.floor,
          bedrooms:    unit.bedrooms,
          bathrooms:   unit.bathrooms,
          area:        unit.area,
          description: unit.description,
          amenities:   unit.amenities,
          status:      unit.status,
          photos:      unit.photos,
        }}
      />
    </div>
  );
}