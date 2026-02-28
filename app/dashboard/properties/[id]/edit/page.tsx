import { PageHeader } from "@/components/ui/FormComponents";
import PropertyForm from "@/components/dashboard/PropertyForm";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function EditPropertyPage({
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

  const property = await prisma.property.findUnique({
    where: { id },
  });

  if (!property || property.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Edit Property"
        description="Update the details of the building or compound."
      />

      {/* Render the form in Edit mode by passing initialData */}
      <PropertyForm initialData={property} />
    </div>
  );
}
