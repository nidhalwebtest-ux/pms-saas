import { redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/rbac-server";
import { ALL_ENTITY_KEYS, normalizeMatrix } from "@/lib/rbac";
import RolesList from "./RolesList";

export const dynamic = "force-dynamic";

const SYSTEM_ORDER = ["OWNER", "MANAGER", "STAFF", "ACCOUNTANT"];

export default async function RolesPage() {
  let actor;
  try { actor = await requireOrgUser(); } catch { redirect("/login"); }

  await ensureSystemRoles(actor.organizationId);

  const roles = await prisma.role.findMany({
    where: { organizationId: actor.organizationId },
    select: {
      id: true, name: true, key: true, isSystem: true, description: true,
      permissions: true, _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  // Count entities with any access (level != NONE) for a quick summary chip.
  const items = roles.map((r) => {
    const map = normalizeMatrix(r.permissions);
    const granted = ALL_ENTITY_KEYS.filter((k) => map[k] !== "NONE").length;
    return {
      id: r.id, name: r.name, key: r.key, isSystem: r.isSystem,
      description: r.description, members: r._count.users,
      granted, total: ALL_ENTITY_KEYS.length,
    };
  }).sort((a, b) => {
    if (a.isSystem && b.isSystem) return SYSTEM_ORDER.indexOf(a.key ?? "") - SYSTEM_ORDER.indexOf(b.key ?? "");
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <RolesList roles={items} />
    </div>
  );
}
