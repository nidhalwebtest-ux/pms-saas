/* ============================================================================
 *  Date helpers used by the seeder. Thin wrappers around the JS Date API so
 *  every seed run pins to a consistent "today" — needed because the spec
 *  calls for reservations relative to NOW (arriving today, overdue, etc).
 * ========================================================================= */

/** Pinned "today" for the seed run — uses the actual current date. The
 *  seeder snapshots this once at startup so a slow seed does not drift
 *  across midnight. */
export const TODAY: Date = startOfDay(new Date());

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/** YYYY-MM-DD anchored to a fixed year (for Khareef / Eid windows). */
export function fixedDate(year: number, month: number, day: number): Date {
  const x = new Date(year, month - 1, day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/* ── Khareef + Eid windows used by the seeded UnitPrice rows ──────────── */

export const KHAREEF_2025 = {
  start: fixedDate(2025, 7, 1),
  end:   fixedDate(2025, 8, 31),
};
export const KHAREEF_2026 = {
  start: fixedDate(2026, 7, 1),
  end:   fixedDate(2026, 8, 31),
};
export const EID_2026 = {
  start: fixedDate(2026, 6, 5),
  end:   fixedDate(2026, 6, 15),
};

/** Returns true if any day in [a, b) falls inside [winStart, winEnd]. */
export function overlapsWindow(a: Date, b: Date, winStart: Date, winEnd: Date): boolean {
  return a <= winEnd && b > winStart;
}
