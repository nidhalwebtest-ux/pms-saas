import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import ReservationsView from "./ReservationsView";

export default async function ReservationsPage() {
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

  return <ReservationsView properties={properties} />;
}
