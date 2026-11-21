/** Shared date helpers for the CRM (local context, en-GB day-month-year). */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Day-level start of a date (drops time) for due-date comparisons. */
function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "overdue" | "today" | "upcoming" relative to now, day-level. */
export function dueState(iso: string | null | undefined): "overdue" | "today" | "upcoming" | "none" {
  if (!iso) return "none";
  const due = dayStart(new Date(iso));
  const today = dayStart(new Date());
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}
