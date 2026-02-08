import {
  differenceInCalendarDays,
  differenceInMonths,
  addMonths,
  setHours,
  setMinutes,
  startOfDay, // <--- We need this
} from "date-fns";

// ... (Keep DEFAULT_CHECK_IN_HOUR constants) ...
const DEFAULT_CHECK_IN_HOUR = 14;
const DEFAULT_CHECK_OUT_HOUR = 12;

export function normalizeReservationDates(start: Date, end: Date) {
  const checkIn = setMinutes(setHours(start, DEFAULT_CHECK_IN_HOUR), 0);
  const checkOut = setMinutes(setHours(end, DEFAULT_CHECK_OUT_HOUR), 0);
  return { checkIn, checkOut };
}

export function calculatePeriod(
  start: Date,
  end: Date,
  type: "DAILY" | "MONTHLY" | "YEARLY",
) {
  // FIX: For Calculation, we strictly use Midnight to Midnight
  // This ensures Feb 8 to Mar 8 is exactly 1 Month, ignoring the 2-hour checkout gap.
  const calcStart = startOfDay(start);
  const calcEnd = startOfDay(end);

  if (calcEnd <= calcStart) {
    return {
      quantity: 0,
      unit: type,
      exactDuration: 0,
      months: 0,
      extraDays: 0,
    };
  }

  // A. DAILY (Nights)
  if (type === "DAILY") {
    const nights = differenceInCalendarDays(calcEnd, calcStart);
    return { quantity: nights, unit: "Nights", exactDuration: nights };
  }

  // B. MONTHLY (Leases)
  if (type === "MONTHLY") {
    let months = differenceInMonths(calcEnd, calcStart);

    // Calculate remaining days after removing full months
    const dateAfterMonths = addMonths(calcStart, months);
    const extraDays = differenceInCalendarDays(calcEnd, dateAfterMonths);

    // FIX: If user picks "Feb 8 to Mar 8", differenceInMonths might be unstable if we didn't use startOfDay.
    // Now it is stable.

    // Rounding logic: If the math returns 0.999 months, we want 1.
    // But since we use startOfDay, it should be exact.

    return {
      // If it's exactly 1 month (0 extra days), quantity is 1.
      // If 1 month + 15 days, quantity is 1.5
      quantity: months + extraDays / 30,
      months,
      extraDays,
      unit: "Months",
    };
  }

  // Yearly Logic (Simple version)
  if (type === "YEARLY") {
    const years = differenceInMonths(calcEnd, calcStart) / 12;
    return { quantity: years, unit: "Years" };
  }

  return { quantity: 0, unit: type };
}
