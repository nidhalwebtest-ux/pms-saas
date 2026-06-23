/** Client-safe area types + label resolution (no server imports). */

export type AreaOption = {
  id: string;
  name: string;
  nameAr: string | null;
  color: string;
};

/** Pick the locale-appropriate area name. Falls back to the English name. */
export function pickAreaLabel(
  locale: string,
  name: string | null | undefined,
  nameAr: string | null | undefined,
): string {
  if (!name && !nameAr) return "—";
  if (locale.startsWith("ar")) return (nameAr && nameAr.trim()) || name || "—";
  return name || "—";
}
