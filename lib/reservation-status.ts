/**
 * Reservation Status System
 *
 * Stored status (ReservationStatus enum — Prisma):
 *   PENDING | CONFIRMED | CHECKED_IN | COMPLETED | CANCELLED | NO_SHOW
 *
 * Display status (computed from storedStatus + today, NEVER stored in DB):
 *   Drives badges, row colours, action buttons, and tab filters.
 *
 * NOTE: COMPLETED = "Checked Out" in this application.
 */

export type StoredStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type DisplayStatus =
  | "Upcoming"
  | "Arriving Today"
  | "Overdue Arrival"
  | "In House"
  | "Due Checkout"
  | "Overstay"
  | "Checked Out"
  | "Cancelled"
  | "No Show"
  | "Pending";

export interface DisplayStatusInfo {
  label:      DisplayStatus;
  /** Full Tailwind class string for the badge pill. */
  badgeClass: string;
  /** Full Tailwind class string for the table row background. */
  rowClass:   string;
  /** Sort priority: 1 = most urgent → 10 = least. */
  priority:   number;
  /** true → receptionist action is needed. */
  urgent:     boolean;
  /** true → add animate-pulse (Overstay only). */
  pulse:      boolean;
}

/** Normalize any Date / ISO string to local-midnight timestamp for day comparison. */
function toLocalDay(d: Date | string): number {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

/**
 * Computes the display status for a reservation.
 *
 * @param storedStatus  Value from the DB (ReservationStatus enum).
 * @param checkInDate   Reservation startDate (Date or ISO string).
 * @param checkOutDate  Reservation endDate  (Date or ISO string).
 * @param today         Override for testability — defaults to new Date().
 */
export function getDisplayStatus(
  storedStatus: StoredStatus,
  checkInDate:  Date | string,
  checkOutDate: Date | string,
  today:        Date = new Date(),
): DisplayStatusInfo {
  const todayMs    = toLocalDay(today);
  const checkInMs  = toLocalDay(checkInDate);
  const checkOutMs = toLocalDay(checkOutDate);

  switch (storedStatus) {
    case "CANCELLED":
      return {
        label:      "Cancelled",
        badgeClass: "bg-gray-100 text-gray-500",
        rowClass:   "opacity-60",
        priority:   9,
        urgent:     false,
        pulse:      false,
      };

    case "NO_SHOW":
      return {
        label:      "No Show",
        badgeClass: "bg-gray-700 text-white",
        rowClass:   "opacity-60",
        priority:   10,
        urgent:     false,
        pulse:      false,
      };

    case "COMPLETED":
      return {
        label:      "Checked Out",
        badgeClass: "bg-blue-100 text-blue-700",
        rowClass:   "",
        priority:   7,
        urgent:     false,
        pulse:      false,
      };

    // PENDING is treated as CONFIRMED for date-based display.
    // Receptionists see "Arriving Today" / "Upcoming" etc., not a useless "Pending" badge.
    case "PENDING":
    // falls through ↓

    case "CONFIRMED": {
      if (checkInMs > todayMs) {
        return {
          label:      "Upcoming",
          badgeClass: "bg-sky-100 text-sky-700",
          rowClass:   "",
          priority:   6,
          urgent:     false,
          pulse:      false,
        };
      }
      if (checkInMs === todayMs) {
        return {
          label:      "Arriving Today",
          badgeClass: "bg-orange-500 text-white",
          rowClass:   "bg-amber-50",
          priority:   3,
          urgent:     true,
          pulse:      false,
        };
      }
      // checkInMs < todayMs — late, not yet checked in
      return {
        label:      "Overdue Arrival",
        badgeClass: "bg-red-600 text-white",
        rowClass:   "bg-red-50",
        priority:   4,
        urgent:     true,
        pulse:      false,
      };
    }

    case "CHECKED_IN": {
      if (checkOutMs > todayMs) {
        return {
          label:      "In House",
          badgeClass: "bg-green-500 text-white",
          rowClass:   "",
          priority:   5,
          urgent:     false,
          pulse:      false,
        };
      }
      if (checkOutMs === todayMs) {
        return {
          label:      "Due Checkout",
          badgeClass: "bg-orange-500 text-white",
          rowClass:   "bg-orange-50",
          priority:   2,
          urgent:     true,
          pulse:      false,
        };
      }
      // checkOutMs < todayMs — past due, still occupied
      return {
        label:      "Overstay",
        badgeClass: "bg-red-600 text-white",
        rowClass:   "bg-red-100",
        priority:   1,
        urgent:     true,
        pulse:      true,
      };
    }
  }
}

// ── Transition rules ──────────────────────────────────────────────────────────

/**
 * Allowed stored-status transitions.
 * Terminal states (COMPLETED, CANCELLED, NO_SHOW) are absent → no transitions.
 */
export const VALID_TRANSITIONS: Partial<Record<StoredStatus, StoredStatus[]>> = {
  PENDING:    ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED:  ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED", "CANCELLED"],
};

/** Returns true if `current → target` is a valid transition. */
export function canTransitionTo(
  current: StoredStatus,
  target:  StoredStatus,
): boolean {
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

// ── Tab keys ──────────────────────────────────────────────────────────────────

export type TabKey =
  | "all"
  | "arriving"
  | "overdueArrival"
  | "inHouse"
  | "dueCheckout"
  | "overstay"
  | "upcoming"
  | "checkedOut"
  | "cancelled"
  | "noShow";

/** Maps a DisplayStatus label to its tab-filter key. */
export function displayStatusToTab(label: DisplayStatus): TabKey {
  const map: Record<DisplayStatus, TabKey> = {
    "Upcoming":        "upcoming",
    "Arriving Today":  "arriving",
    "Overdue Arrival": "overdueArrival",
    "In House":        "inHouse",
    "Due Checkout":    "dueCheckout",
    "Overstay":        "overstay",
    "Checked Out":     "checkedOut",
    "Cancelled":       "cancelled",
    "No Show":         "noShow",
    "Pending":         "all",
  };
  return map[label];
}
