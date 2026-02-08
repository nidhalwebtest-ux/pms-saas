// utils/date-math.ts
import {
  differenceInCalendarDays,
  differenceInMonths,
  addMonths,
  setHours,
  setMinutes,
  startOfDay,
  isSameDay,
} from "date-fns";

// -----------------------------------------
// 1. CONFIGURATION
// -----------------------------------------
// In a real app, fetch these from the Property Settings DB
const DEFAULT_CHECK_IN_HOUR = 14; // 2:00 PM
const DEFAULT_CHECK_OUT_HOUR = 12; // 12:00 PM

// -----------------------------------------
// 2. NORMALIZATION (The Fixer)
// -----------------------------------------
/**
 * Takes raw dates from the DatePicker (which might be midnight)
 * and forces the correct Check-in/Check-out times.
 */
export function normalizeReservationDates(start: Date, end: Date) {
  // Force Start Date to 2:00 PM
  const checkIn = setMinutes(setHours(start, DEFAULT_CHECK_IN_HOUR), 0);

  // Force End Date to 12:00 PM
  const checkOut = setMinutes(setHours(end, DEFAULT_CHECK_OUT_HOUR), 0);

  return { checkIn, checkOut };
}

// -----------------------------------------
// 3. CALCULATION ENGINE
// -----------------------------------------
export function calculatePeriod(
  start: Date,
  end: Date,
  type: "DAILY" | "MONTHLY" | "YEARLY",
) {
  const { checkIn, checkOut } = normalizeReservationDates(start, end);

  // Validation: End must be after Start
  if (checkOut <= checkIn) {
    return {
      error: "Check-out must be after Check-in",
      quantity: 0,
      unit: type,
    };
  }

  // A. DAILY LOGIC (Hotels)
  if (type === "DAILY") {
    // "Nights" is simply the difference in calendar days
    // Feb 1 (2 PM) to Feb 2 (12 PM) = 1 Day difference
    const nights = differenceInCalendarDays(checkOut, checkIn);
    return { quantity: nights, unit: "Nights", exactDuration: nights };
  }

  // B. MONTHLY LOGIC (Leases)
  if (type === "MONTHLY") {
    // Calculate full months
    let months = differenceInMonths(checkOut, checkIn);

    // Check if there are extra days remaining
    // Example: Jan 1 to Feb 5 = 1 Month + 4 Days
    const dateAfterMonths = addMonths(checkIn, months);
    const extraDays = differenceInCalendarDays(checkOut, dateAfterMonths);

    // Rounding Logic:
    // If extra days > 15, usually counts as full month or 0.5 depending on policy.
    // For now, let's return exact breakdown.
    return {
      quantity: months + extraDays / 30, // Approximate decimal for pricing
      months,
      extraDays,
      unit: "Months",
    };
  }

  return { quantity: 0, unit: type };
}
