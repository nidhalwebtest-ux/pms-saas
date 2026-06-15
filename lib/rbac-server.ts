import { prisma } from "@/lib/prisma";
import { DEFAULT_MATRICES, SYSTEM_ROLES, normalizeMatrix } from "@/lib/rbac";

/**
 * Ensure the 4 system roles exist for an org (lazy seed on first Roles-page
 * visit). System roles are read-only templates; their matrices come from
 * DEFAULT_MATRICES. Names are the English defaults (the UI localizes the display
 * label for system roles via their `key`).
 */
const SYSTEM_ROLE_NAMES: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Administrator",
  STAFF: "Receptionist",
  ACCOUNTANT: "Accountant",
};

export async function ensureSystemRoles(organizationId: string): Promise<void> {
  const existing = await prisma.role.findMany({
    where: { organizationId, isSystem: true },
    select: { key: true },
  });
  const have = new Set(existing.map((r) => r.key));
  const missing = SYSTEM_ROLES.filter((r) => !have.has(r.key));
  if (missing.length === 0) return;

  await prisma.$transaction(
    missing.map((r) =>
      prisma.role.create({
        data: {
          organizationId,
          name: SYSTEM_ROLE_NAMES[r.key] ?? r.key,
          key: r.key,
          isSystem: true,
          permissions: normalizeMatrix(DEFAULT_MATRICES[r.key]),
        },
      }),
    ),
  );
}
