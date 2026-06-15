import { prisma } from "@/lib/prisma";

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
