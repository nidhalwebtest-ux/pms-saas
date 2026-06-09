import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
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

  const [allProperties, org, selectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where:   { organizationId: dbUser.organizationId, isArchived: false },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where:  { id: dbUser.organizationId },
      select: { allowEarlyCheckIn: true },
    }),
    getSelectedPropertyId(),
  ]);

  // Same pattern as units list: when a building is globally selected, lock
  // the dropdown to it. When "All buildings" is active, show every property.
  const properties = selectedPropertyId
    ? allProperties.filter((p) => p.id === selectedPropertyId)
    : allProperties;

  return (
    <ReservationsView
      properties={properties}
      defaultPropertyId={selectedPropertyId ?? ""}
      scopedToBuilding={!!selectedPropertyId}
      allowEarlyCheckIn={org?.allowEarlyCheckIn ?? false}
    />
  );
}
