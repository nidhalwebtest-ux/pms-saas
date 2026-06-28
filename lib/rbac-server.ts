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
    select: { id: true, key: true, permissions: true },
  });
  const byKey = new Map(existing.map((r) => [r.key, r]));

  const creates: ReturnType<typeof prisma.role.create>[] = [];
  const updates: ReturnType<typeof prisma.role.update>[] = [];

  for (const r of SYSTEM_ROLES) {
    const desired = normalizeMatrix(DEFAULT_MATRICES[r.key]);
    const cur = byKey.get(r.key);
    if (!cur) {
      creates.push(
        prisma.role.create({
          data: {
            organizationId,
            name: SYSTEM_ROLE_NAMES[r.key] ?? r.key,
            key: r.key,
            isSystem: true,
            permissions: desired,
          },
        }),
      );
    } else if (JSON.stringify(normalizeMatrix(cur.permissions)) !== JSON.stringify(desired)) {
      // Self-heal: keep system-role matrices in sync with the current catalog so
      // newly-added entities (e.g. reconciliation/banks/reports/actions) are
      // granted to existing system roles instead of defaulting to NONE.
      updates.push(prisma.role.update({ where: { id: cur.id }, data: { permissions: desired } }));
    }
  }

  const ops = [...creates, ...updates];
  if (ops.length) await prisma.$transaction(ops);
}
