import { redirect } from "next/navigation";
import { assertView } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import ReservationsView from "./ReservationsView";

export default async function ReservationsPage() {
  await assertView("reservations");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  // Restrict the building dropdown to the user's accessible buildings.
  const accessible = await getSessionAccessibleProperties();

  const [allProperties, org, selectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where:   {
        organizationId: dbUser.organizationId,
        isArchived: false,
        ...(accessible ? { id: { in: accessible } } : {}),
      },
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
