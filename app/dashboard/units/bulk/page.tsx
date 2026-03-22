import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import BulkCreateForm from "./BulkCreateForm";

export default async function BulkCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bulk Unit Creation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate multiple units at once. Configure shared settings, specify a naming range, then review and create.
        </p>
      </div>
      <BulkCreateForm properties={properties} defaultPropertyId={propertyId} />
    </div>
  );
}
