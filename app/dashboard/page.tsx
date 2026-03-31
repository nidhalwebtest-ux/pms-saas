import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { Role } from "@/lib/permissions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const [dbUser, selectedPropertyId] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        organizationId: true,
        firstName: true,
        role: true,
      },
    }),
    getSelectedPropertyId(),
  ]);

  if (!dbUser) redirect("/login");

  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser.organizationId ?? "", isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardShell
      user={{
        firstName: dbUser.firstName ?? "there",
        role: dbUser.role as Role,
      }}
      propertyId={selectedPropertyId}
      properties={properties}
    />
  );
}
