"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { deleteOrganizationData } from "@/lib/admin/delete-organization";

export type DeleteOrgResult =
  | { ok: true; deletedUsers: number; authFailures: number }
  | { error: "not_authorized" | "not_found" | "name_mismatch" | "own_org" | "failed" };

/**
 * Permanently delete an organization with all its data and its users' logins.
 * Guarded three ways: super-admin only, the exact org name must be typed, and
 * the super-admin cannot delete the organization their own account belongs to.
 */
export async function deleteOrganization(id: string, typedName: string): Promise<DeleteOrgResult> {
  const admin = await getSuperAdmin();
  if (!admin) return { error: "not_authorized" };

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { name: true, users: { select: { id: true } } },
  });
  if (!org) return { error: "not_found" };
  if (typedName.trim() !== org.name.trim()) return { error: "name_mismatch" };
  if (org.users.some((u) => u.id === admin.id)) return { error: "own_org" };

  let userIds: string[];
  try {
    ({ userIds } = await deleteOrganizationData(prisma, id));
  } catch (err) {
    console.error("[deleteOrganization] DB delete failed — nothing was removed:", err);
    return { error: "failed" };
  }

  // DB rows are gone; now remove the members' Supabase logins so they can't
  // sign back in to an empty account. Best-effort: a failure here leaves an
  // orphaned login (no data), which is reported back to the caller.
  const supabase = createAdminClient();
  let authFailures = 0;
  for (const uid of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error && !/not.?found/i.test(error.message)) {
      authFailures++;
      console.error(`[deleteOrganization] auth user ${uid} not deleted:`, error.message);
    }
  }

  console.info(`[deleteOrganization] ${admin.email} deleted org "${org.name}" (${id}), ${userIds.length} user(s)`);
  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  return { ok: true, deletedUsers: userIds.length, authFailures };
}
