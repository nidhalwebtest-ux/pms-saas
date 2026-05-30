/**
 * Computed unit display status.
 *
 * The Unit.status field (AVAILABLE | MAINTENANCE) is a manual override.
 * The actual display status is derived from active reservations AND the date:
 *
 *   MAINTENANCE  → "Under Maintenance"  (manual override, highest priority)
 *   CHECKED_IN, endDate < today → "Overstay"  (guest still inside past checkout)
 *   CHECKED_IN, otherwise       → "Occupied"  (guest currently inside)
 *   CONFIRMED/PENDING → "Reserved"      (booked, not yet checked in)
 *   (none)       → "Vacant"             (free to accept new bookings)
 *
 * Both "occupied" and "overstay" mean the unit is NOT free — see UNIT_BLOCKING_STATUSES.
 * An overstay is a checked-in reservation whose endDate has already passed; it is
 * shown distinctly (so staff act on it) but still blocks the unit from new bookings.
 */

export type UnitDisplayStatus = "vacant" | "occupied" | "overstay" | "reserved" | "maintenance";

/** Display statuses where the unit is physically unavailable for a new check-in. */
export const UNIT_BLOCKING_STATUSES: ReadonlySet<UnitDisplayStatus> = new Set([
  "occupied",
  "overstay",
  "maintenance",
]);

function toLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function getUnitDisplayStatus(
  unitStatus: string,
  activeReservations: { status: string; endDate?: Date | string | null }[],
  today: Date = new Date(),
): UnitDisplayStatus {
  if (unitStatus === "MAINTENANCE") return "maintenance";

  const checkedIn = activeReservations.filter((r) => r.status === "CHECKED_IN");
  if (checkedIn.length > 0) {
    const todayMs = toLocalDay(today);
    // Overstay only when we have a date AND it's strictly before today.
    // Missing endDate (legacy/partial selects) falls back to plain "occupied".
    const isOverstay = checkedIn.some((r) => {
      if (!r.endDate) return false;
      return toLocalDay(new Date(r.endDate)) < todayMs;
    });
    const hasCurrent = checkedIn.some((r) => {
      if (!r.endDate) return true;
      return toLocalDay(new Date(r.endDate)) >= todayMs;
    });
    // If any current in-house stay exists, show Occupied; else if only past-end
    // stays remain, it's an Overstay.
    if (hasCurrent) return "occupied";
    if (isOverstay) return "overstay";
    return "occupied";
  }

  if (activeReservations.some((r) => ["CONFIRMED", "PENDING"].includes(r.status))) return "reserved";
  return "vacant";
}

export const UNIT_STATUS_CONFIG: Record<
  UnitDisplayStatus,
  { label: string; badge: string; dot: string }
> = {
  vacant:      { label: "Vacant",           badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  occupied:    { label: "Occupied",          badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500"    },
  overstay:    { label: "Overstay",          badge: "bg-red-100 text-red-700",         dot: "bg-red-500"     },
  reserved:    { label: "Reserved",          badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500"  },
  maintenance: { label: "Under Maintenance", badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500"   },
};
