import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePermissions, atLeast, type PermissionMap, type PermissionLevel } from "@/lib/rbac";

/**
 * Server-side effective access for the current user. Single source of truth for
 * permission checks in server components / actions / API routes (Phase 2
 * enforcement). Falls back to the legacy enum role's default matrix when the
 * user has no assigned custom role. OWNER always passes.
 */
export interface SessionAccess {
  userId: string;
  organizationId: string;
  role: string;
  roleKey: string | null;
  isOwner: boolean;
  perms: PermissionMap;
  can: (entity: string, level: PermissionLevel) => boolean;
  canView: (entity: string) => boolean;
  canCreate: (entity: string) => boolean;
  canEdit: (entity: string) => boolean;
  canDelete: (entity: string) => boolean;
}

export async function getSessionAccess(): Promise<SessionAccess | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      organizationId: true,
      role: true,
      assignedRole: { select: { key: true, permissions: true } },
    },
  });
  if (!dbUser?.organizationId) return null;

  const enumRole = dbUser.role ?? "STAFF";
  const { perms, isOwner, roleKey } = resolvePermissions(enumRole, dbUser.assignedRole);
  const can = (entity: string, level: PermissionLevel) => isOwner || atLeast(perms, entity, level);

  return {
    userId: user.id,
    organizationId: dbUser.organizationId,
    role: enumRole,
    roleKey,
    isOwner,
    perms,
    can,
    canView: (e) => can(e, "VIEW"),
    canCreate: (e) => can(e, "CREATE"),
    canEdit: (e) => can(e, "EDIT"),
    canDelete: (e) => can(e, "FULL"),
  };
}

/**
 * Page guard: require at least VIEW on `entity` or redirect away. Returns the
 * resolved access so the page can also drive button visibility (canCreate, …).
 */
export async function assertView(entity: string): Promise<SessionAccess> {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  if (!access.canView(entity)) redirect("/dashboard/no-access");
  return access;
}

/**
 * Server-action / API guard: throw unless the user has at least `level` on
 * `entity`. Throws a plain Error("forbidden") for callers to surface.
 */
export async function requireAccess(entity: string, level: PermissionLevel): Promise<SessionAccess> {
  const access = await getSessionAccess();
  if (!access || !access.can(entity, level)) throw new Error("forbidden");
  return access;
}

/**
 * Non-throwing variant for actions that return a result shape:
 * `if (!(await hasAccess("tenants","CREATE"))) return { error: "forbidden" };`
 */
export async function hasAccess(entity: string, level: PermissionLevel): Promise<boolean> {
  const access = await getSessionAccess();
  return !!access && access.can(entity, level);
}
