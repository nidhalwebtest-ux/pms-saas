import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/current-user";

/**
 * Per-user building (property) scoping.
 *
 * A user with NO PropertyAssignment rows is UNRESTRICTED (sees all org
 * buildings) — returns null. A user with rows is restricted to that set —
 * returns the property id list. Owners are always unrestricted (handled by the
 * caller via isOwner). "All" for a restricted user means the union of their
 * assigned buildings.
 */
export async function getAccessiblePropertyIds(
  userId: string,
  organizationId: string,
): Promise<string[] | null> {
  const rows = await prisma.propertyAssignment.findMany({
    where: { userId, property: { organizationId } },
    select: { propertyId: true },
  });
  return rows.length ? rows.map((r) => r.propertyId) : null;
}

/** True if a user may access a given property (null accessible = unrestricted). */
export function canAccessProperty(accessible: string[] | null, propertyId: string | null | undefined): boolean {
  if (accessible === null) return true;
  return !!propertyId && accessible.includes(propertyId);
}

/** Accessible property ids for the CURRENT session (null = unrestricted/owner).
 *  Cached per request — called by getEffectivePropertyIds on most list pages. */
export const getSessionAccessibleProperties = cache(async (): Promise<string[] | null> => {
  const dbUser = await getSessionUser();
  if (!dbUser?.organizationId || dbUser.role === "OWNER") return null;
  return getAccessiblePropertyIds(dbUser.id, dbUser.organizationId);
});

/**
 * Resolve the effective set of property ids a list query should be limited to,
 * combining a specific selection with the user's accessible set.
 * Returns null = no property filter (unrestricted + no specific selection).
 */
export async function getEffectivePropertyIds(selectedId?: string): Promise<string[] | null> {
  const accessible = await getSessionAccessibleProperties();
  if (selectedId) {
    // A specific building: honor it, but never outside the accessible set.
    if (accessible && !accessible.includes(selectedId)) return accessible;
    return [selectedId];
  }
  return accessible; // null = all org; otherwise limited to assigned buildings
}
