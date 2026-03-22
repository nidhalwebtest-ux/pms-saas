/**
 * Computed unit display status.
 *
 * The Unit.status field (AVAILABLE | MAINTENANCE) is a manual override.
 * The actual display status is derived from active reservations:
 *
 *   MAINTENANCE  → "Under Maintenance"  (manual override, highest priority)
 *   CHECKED_IN   → "Occupied"           (guest currently inside)
 *   CONFIRMED/PENDING → "Reserved"      (booked, not yet checked in)
 *   (none)       → "Vacant"             (free to accept new bookings)
 */

export type UnitDisplayStatus = "vacant" | "occupied" | "reserved" | "maintenance";

export function getUnitDisplayStatus(
  unitStatus: string,
  activeReservations: { status: string }[],
): UnitDisplayStatus {
  if (unitStatus === "MAINTENANCE") return "maintenance";
  if (activeReservations.some((r) => r.status === "CHECKED_IN"))                    return "occupied";
  if (activeReservations.some((r) => ["CONFIRMED", "PENDING"].includes(r.status))) return "reserved";
  return "vacant";
}

export const UNIT_STATUS_CONFIG: Record<
  UnitDisplayStatus,
  { label: string; badge: string; dot: string }
> = {
  vacant:      { label: "Vacant",           badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  occupied:    { label: "Occupied",          badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500"    },
  reserved:    { label: "Reserved",          badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500"  },
  maintenance: { label: "Under Maintenance", badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"   },
};
