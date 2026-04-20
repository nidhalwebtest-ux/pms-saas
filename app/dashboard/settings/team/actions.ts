"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { sendInvitationEmail } from "@/lib/email";
import type { UserRole } from "@prisma/client";

const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getCallerWithOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true, role: true, firstName: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  return { authId: user.id, ...dbUser, organizationId: dbUser.organizationId };
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// ── Send invitation ───────────────────────────────────────────────────────────

export async function sendInvitation(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const tErr   = await getTranslations("settings.team.errors");
  const tInv   = await getTranslations("settings.team.invite");
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "manageTeam")) {
    return { error: tErr("noPermission") };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role  = formData.get("role") as UserRole;

  if (!email) return { error: tErr("emailRequired") };
  if (!["MANAGER", "STAFF", "ACCOUNTANT"].includes(role)) {
    return { error: tErr("invalidRole") };
  }
  // Only OWNER can invite MANAGER (Admin)
  if (role === "MANAGER" && caller.role !== "OWNER") {
    return { error: tErr("ownerOnlyAdmin") };
  }

  // Already a member?
  const existing = await prisma.user.findFirst({
    where: { email, organizationId: caller.organizationId },
  });
  if (existing) return { error: tErr("alreadyMember") };

  // Already has a pending (non-cancelled, non-expired) invite?
  const pending = await prisma.invitation.findFirst({
    where: {
      email,
      organizationId: caller.organizationId,
      usedAt:      null,
      cancelledAt: null,
      expiresAt:   { gt: new Date() },
    },
  });
  if (pending) return { error: tErr("pendingExists") };

  // Get org name for the email
  const org = await prisma.organization.findUnique({
    where:  { id: caller.organizationId },
    select: { name: true },
  });

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      organizationId: caller.organizationId,
      invitedById:    caller.id,
      expiresAt:      new Date(Date.now() + INVITE_EXPIRY_MS),
    },
  });

  const origin    = await getOrigin();
  const inviteUrl = `${origin}/invite/${invitation.token}`;

  try {
    await sendInvitationEmail(
      email,
      inviteUrl,
      caller.firstName ?? "Your team admin",
      org?.name ?? "OmRent",
      ROLE_LABELS[role],
    );
  } catch (err) {
    console.error("[sendInvitation] email failed:", err);
    // Don't block — invitation is saved, user can resend
  }

  revalidatePath("/dashboard/settings/team");
  return { success: tInv("sentToast", { email }) };
}

// ── Resend invitation ─────────────────────────────────────────────────────────

export async function resendInvitation(invitationId: string) {
  const caller = await getCallerWithOrg();
  if (!can(caller.role, "manageTeam")) return;

  const invite = await prisma.invitation.findUnique({
    where:   { id: invitationId },
    include: { organization: { select: { name: true } } },
  });
  if (!invite || invite.organizationId !== caller.organizationId) return;
  if (invite.usedAt || invite.cancelledAt) return;

  // Extend expiry by 72h from now
  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data:  { expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS) },
  });

  const origin    = await getOrigin();
  const inviteUrl = `${origin}/invite/${updated.token}`;

  await sendInvitationEmail(
    invite.email,
    inviteUrl,
    caller.firstName ?? "Your team admin",
    invite.organization.name,
    ROLE_LABELS[invite.role],
  ).catch(console.error);

  revalidatePath("/dashboard/settings/team");
}

// ── Cancel invitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(invitationId: string) {
  const caller = await getCallerWithOrg();
  if (!can(caller.role, "manageTeam")) return;

  const invite = await prisma.invitation.findUnique({
    where:  { id: invitationId },
    select: { organizationId: true },
  });
  if (!invite || invite.organizationId !== caller.organizationId) return;

  await prisma.invitation.update({
    where: { id: invitationId },
    data:  { cancelledAt: new Date() },
  });

  revalidatePath("/dashboard/settings/team");
}

// ── Update member role ────────────────────────────────────────────────────────

export async function updateMemberRole(memberId: string, newRole: UserRole) {
  const tErr   = await getTranslations("settings.team.errors");
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "changeRoles")) throw new Error(tErr("ownerOnlyChangeRoles"));
  if (memberId === caller.id) throw new Error(tErr("cannotChangeOwnRole"));

  const target = await prisma.user.findUnique({
    where:  { id: memberId },
    select: { role: true, organizationId: true },
  });
  if (!target || target.organizationId !== caller.organizationId) throw new Error(tErr("memberNotFound"));
  if (target.role === "OWNER") throw new Error(tErr("ownerCannotChange"));

  await prisma.user.update({ where: { id: memberId }, data: { role: newRole } });
  revalidatePath("/dashboard/settings/team");
}

// ── Remove team member ────────────────────────────────────────────────────────

export async function removeTeamMember(memberId: string) {
  const tErr   = await getTranslations("settings.team.errors");
  const caller = await getCallerWithOrg();

  if (!can(caller.role, "removeTeamMember")) throw new Error(tErr("ownerOnlyRemove"));
  if (memberId === caller.id) throw new Error(tErr("cannotRemoveSelf"));

  const target = await prisma.user.findUnique({
    where:  { id: memberId },
    select: { role: true, organizationId: true },
  });
  if (!target || target.organizationId !== caller.organizationId) throw new Error(tErr("memberNotFound"));
  if (target.role === "OWNER") throw new Error(tErr("ownerCannotRemove"));

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(memberId);
  await prisma.user.delete({ where: { id: memberId } });

  revalidatePath("/dashboard/settings/team");
}
