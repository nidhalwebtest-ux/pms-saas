"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

// ── Shared auth helper ────────────────────────────────────────────────────────

async function getCallerWithOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  return { authId: user.id, ...dbUser, organizationId: dbUser.organizationId };
}

// ── Add team member ───────────────────────────────────────────────────────────

export async function addTeamMember(formData: FormData) {
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "manageTeam")) {
    throw new Error("You do not have permission to add team members.");
  }

  const firstName = formData.get("firstName") as string;
  const email     = formData.get("email")     as string;
  const password  = formData.get("password")  as string;
  const role      = formData.get("role")      as UserRole;

  // Only OWNER can assign MANAGER (Admin) role
  if (role === "MANAGER" && caller.role !== "OWNER") {
    throw new Error("Only the Owner can assign the Admin role.");
  }

  const adminClient = createAdminClient();
  const { data: newAuth, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) throw new Error(authError.message);
  if (!newAuth.user) throw new Error("Failed to create user.");

  await prisma.user.create({
    data: {
      id:             newAuth.user.id,
      email,
      firstName,
      role,
      organizationId: caller.organizationId,
    },
  });

  revalidatePath("/dashboard/settings/team");
}

// ── Update member role ────────────────────────────────────────────────────────

export async function updateMemberRole(memberId: string, newRole: UserRole) {
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "changeRoles")) {
    throw new Error("Only the Owner can change roles.");
  }
  if (memberId === caller.id) {
    throw new Error("You cannot change your own role.");
  }

  const target = await prisma.user.findUnique({
    where:  { id: memberId },
    select: { role: true, organizationId: true },
  });

  if (!target || target.organizationId !== caller.organizationId) {
    throw new Error("Member not found.");
  }
  if (target.role === "OWNER") {
    throw new Error("The Owner role cannot be changed.");
  }

  await prisma.user.update({
    where: { id: memberId },
    data:  { role: newRole },
  });

  revalidatePath("/dashboard/settings/team");
}

// ── Remove team member ────────────────────────────────────────────────────────

export async function removeTeamMember(memberId: string) {
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "removeTeamMember")) {
    throw new Error("Only the Owner can remove team members.");
  }
  if (memberId === caller.id) {
    throw new Error("You cannot remove yourself.");
  }

  const target = await prisma.user.findUnique({
    where:  { id: memberId },
    select: { role: true, organizationId: true },
  });

  if (!target || target.organizationId !== caller.organizationId) {
    throw new Error("Member not found.");
  }
  if (target.role === "OWNER") {
    throw new Error("The Owner account cannot be removed.");
  }

  const adminClient = createAdminClient();
  // Delete from Supabase Auth (cascades to public.User via DB trigger or we delete manually)
  await adminClient.auth.admin.deleteUser(memberId);
  await prisma.user.delete({ where: { id: memberId } });

  revalidatePath("/dashboard/settings/team");
}
