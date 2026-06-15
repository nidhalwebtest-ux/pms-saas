"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgUser } from "@/lib/tenant";
import { can, type Role } from "@/lib/permissions";
import { normalizeMatrix, type PermissionMap } from "@/lib/rbac";

export type RoleResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function guard() {
  const actor = await requireOrgUser();
  if (!can(actor.role as Role, "manageRoles")) throw new Error("forbidden");
  return actor;
}

/** Create a new custom role (blank or seeded from a template matrix). */
export async function createRole(input: {
  name: string;
  description?: string;
  permissions?: PermissionMap;
}): Promise<RoleResult> {
  let actor;
  try { actor = await guard(); } catch { return { ok: false, error: "forbidden" }; }

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "name_required" };
  if (name.length > 60) return { ok: false, error: "name_too_long" };

  const dup = await prisma.role.findFirst({
    where: { organizationId: actor.organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "duplicate_name" };

  const role = await prisma.role.create({
    data: {
      organizationId: actor.organizationId,
      name,
      description: input.description?.trim() || null,
      isSystem: false,
      permissions: normalizeMatrix(input.permissions ?? {}),
      createdById: actor.userId,
    },
    select: { id: true },
  });
  revalidatePath("/dashboard/settings/roles");
  return { ok: true, id: role.id };
}

/** Duplicate any role (incl. a system role) into a new editable custom role. */
export async function duplicateRole(sourceId: string, newName: string): Promise<RoleResult> {
  let actor;
  try { actor = await guard(); } catch { return { ok: false, error: "forbidden" }; }

  const name = newName?.trim();
  if (!name) return { ok: false, error: "name_required" };

  const src = await prisma.role.findUnique({ where: { id: sourceId }, select: { organizationId: true, permissions: true } });
  if (!src || src.organizationId !== actor.organizationId) return { ok: false, error: "not_found" };

  const dup = await prisma.role.findFirst({
    where: { organizationId: actor.organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "duplicate_name" };

  const role = await prisma.role.create({
    data: {
      organizationId: actor.organizationId,
      name,
      isSystem: false,
      permissions: normalizeMatrix(src.permissions),
      createdById: actor.userId,
    },
    select: { id: true },
  });
  revalidatePath("/dashboard/settings/roles");
  return { ok: true, id: role.id };
}

/** Update a CUSTOM role's name/description/matrix. System roles are read-only. */
export async function updateRole(input: {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionMap;
}): Promise<RoleResult> {
  let actor;
  try { actor = await guard(); } catch { return { ok: false, error: "forbidden" }; }

  const role = await prisma.role.findUnique({
    where: { id: input.id },
    select: { organizationId: true, isSystem: true },
  });
  if (!role || role.organizationId !== actor.organizationId) return { ok: false, error: "not_found" };
  if (role.isSystem) return { ok: false, error: "system_readonly" };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "name_required" };

  const dup = await prisma.role.findFirst({
    where: { organizationId: actor.organizationId, name: { equals: name, mode: "insensitive" }, NOT: { id: input.id } },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "duplicate_name" };

  await prisma.role.update({
    where: { id: input.id },
    data: { name, description: input.description?.trim() || null, permissions: normalizeMatrix(input.permissions) },
  });
  revalidatePath("/dashboard/settings/roles");
  revalidatePath(`/dashboard/settings/roles/${input.id}`);
  return { ok: true };
}

/** Delete a CUSTOM role (system roles cannot be deleted). Reassign members first. */
export async function deleteRole(id: string): Promise<RoleResult> {
  let actor;
  try { actor = await guard(); } catch { return { ok: false, error: "forbidden" }; }

  const role = await prisma.role.findUnique({
    where: { id },
    select: { organizationId: true, isSystem: true, _count: { select: { users: true } } },
  });
  if (!role || role.organizationId !== actor.organizationId) return { ok: false, error: "not_found" };
  if (role.isSystem) return { ok: false, error: "system_readonly" };
  if (role._count.users > 0) return { ok: false, error: "role_in_use" };

  await prisma.role.delete({ where: { id } });
  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}
