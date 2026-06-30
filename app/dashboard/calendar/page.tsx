import "@/styles/calendar.css";
import { assertView } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getSessionAccessibleProperties } from "@/lib/property-scope";
import AvailabilityCalendarView from "./AvailabilityCalendarView";

export default async function CalendarPage() {
  // Calendar is part of the reservations surface — gate on reservations VIEW.
  const { organizationId } = await assertView("reservations");
  const accessible = await getSessionAccessibleProperties();

  const [properties, selectedPropertyId] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, isArchived: false, ...(accessible ? { id: { in: accessible } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSelectedPropertyId(),
  ]);

  return (
    <div className="h-[calc(100dvh-8.5rem)] min-h-[560px]">
      <AvailabilityCalendarView
        properties={properties}
        defaultPropertyId={selectedPropertyId || properties[0]?.id || ""}
      />
    </div>
  );
}
