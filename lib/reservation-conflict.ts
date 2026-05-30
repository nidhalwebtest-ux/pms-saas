/**
 * Reservation conflict detection — SERVER ONLY (imports Prisma types, runs DB queries).
 *
 * Double-booking prevention lives here so every write path (booking creation,
 * check-in) shares ONE implementation. Uses half-open intervals [start, end):
 * a checkout day and the next check-in day on the same date do NOT conflict
 * (standard hotel same-day turnover).
 *
 * A unit can be attached to a reservation two ways — the legacy
 * `Reservation.unitId` column and the `ReservationUnit` join table (multi-unit
 * + mid-stay swaps). Both are checked.
 */

import { Prisma } from "@prisma/client";

/** Statuses that DO NOT block a unit — a conflicting reservation is ignored if it has one of these. */
export const NON_BLOCKING_STATUSES = ["CANCELLED", "NO_SHOW", "COMPLETED"] as const;

export type ConflictDetail = {
  unitId: string;
  unitName: string;
  reservationNumber: string | null;
  guestName: string;
  startDate: string;
  endDate: string;
} | null;

/**
 * Returns details of an existing reservation that overlaps [startDate, endDate)
 * on `unitId`, or null if the unit is free for that range.
 *
 * MUST be called inside a Prisma `$transaction` (ideally Serializable) so the
 * check and the subsequent write are atomic against concurrent bookings.
 */
export async function getUnitConflict(
  tx:        Prisma.TransactionClient,
  unitId:    string,
  unitName:  string,
  startDate: Date,
  endDate:   Date,
  excludeReservationId?: string,
): Promise<ConflictDetail> {
  // Check old-style reservations (Reservation.unitId)
  const conflictOld = await tx.reservation.findFirst({
    where: {
      unitId,
      status: { notIn: [...NON_BLOCKING_STATUSES] },
      ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
      startDate: { lt: endDate },
      endDate:   { gt: startDate },
    },
    select: {
      reservationNumber: true,
      startDate: true,
      endDate: true,
      tenant: { select: { firstName: true, lastName: true } },
    },
  });
  if (conflictOld) {
    return {
      unitId,
      unitName,
      reservationNumber: conflictOld.reservationNumber,
      guestName: `${conflictOld.tenant.firstName} ${conflictOld.tenant.lastName}`,
      startDate: conflictOld.startDate.toISOString(),
      endDate:   conflictOld.endDate.toISOString(),
    };
  }

  // Check new-style reservations (ReservationUnit)
  const conflictNew = await tx.reservationUnit.findFirst({
    where: {
      unitId,
      reservation: {
        status: { notIn: [...NON_BLOCKING_STATUSES] },
        ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
        startDate: { lt: endDate },
        endDate:   { gt: startDate },
      },
    },
    select: {
      reservation: {
        select: {
          reservationNumber: true,
          startDate: true,
          endDate: true,
          tenant: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (conflictNew) {
    return {
      unitId,
      unitName,
      reservationNumber: conflictNew.reservation.reservationNumber,
      guestName: `${conflictNew.reservation.tenant.firstName} ${conflictNew.reservation.tenant.lastName}`,
      startDate: conflictNew.reservation.startDate.toISOString(),
      endDate:   conflictNew.reservation.endDate.toISOString(),
    };
  }
  return null;
}

/**
 * REQUIRE_VACANT policy check: returns details of any OTHER reservation that is
 * still physically CHECKED_IN on `unitId` (not yet checked out), regardless of
 * dates. Used to block a new check-in until the prior guest is checked out —
 * even on a back-to-back turnover day.
 *
 * MUST be called inside the same transaction as the subsequent write.
 */
export async function getCheckedInOccupant(
  tx:        Prisma.TransactionClient,
  unitId:    string,
  unitName:  string,
  excludeReservationId?: string,
): Promise<ConflictDetail> {
  const occupant = await tx.reservation.findFirst({
    where: {
      status: "CHECKED_IN",
      ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
      OR: [
        { unitId },
        { reservationUnits: { some: { unitId, isMovedOut: false } } },
      ],
    },
    select: {
      reservationNumber: true,
      startDate: true,
      endDate: true,
      tenant: { select: { firstName: true, lastName: true } },
    },
  });
  if (!occupant) return null;
  return {
    unitId,
    unitName,
    reservationNumber: occupant.reservationNumber,
    guestName: `${occupant.tenant.firstName} ${occupant.tenant.lastName}`,
    startDate: occupant.startDate.toISOString(),
    endDate:   occupant.endDate.toISOString(),
  };
}
