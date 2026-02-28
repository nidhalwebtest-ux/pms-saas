import { PageHeader } from "@/components/ui/FormComponents";
import UnitForm from "@/components/dashboard/UnitForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function EditUnitPage({
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

  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!unit || unit.property.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Edit Unit"
        description="Update pricing and specifications."
        listHref="/dashboard/units"
      />
      <UnitForm properties={properties} initialData={unit} />
    </div>
  );
}
