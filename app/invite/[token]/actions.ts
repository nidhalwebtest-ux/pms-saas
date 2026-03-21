"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function acceptInvitation(
  token: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const firstName       = (formData.get("firstName") as string)?.trim();
  const lastName        = (formData.get("lastName")  as string)?.trim() || null;
  const password        = (formData.get("password")  as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!firstName)                     return { error: "First name is required." };
  if (password.length < 8)            return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword)   return { error: "Passwords do not match." };

  // Fetch and validate the invitation
  const invite = await prisma.invitation.findUnique({
    where:   { token },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invite)             return { error: "Invitation not found. Please request a new one." };
  if (invite.usedAt)       return { error: "This invitation has already been used." };
  if (invite.cancelledAt)  return { error: "This invitation has been cancelled." };
  if (invite.expiresAt < new Date()) return { error: "This invitation has expired. Please ask your admin to resend it." };

  // Check the email is not already registered in this org
  const existing = await prisma.user.findFirst({
    where: { email: invite.email, organizationId: invite.organizationId },
  });
  if (existing) return { error: "An account with this email already exists." };

  const admin = createAdminClient();

  // Create Supabase auth user (auto-confirmed — no email verification needed)
  const { data: newAuth, error: authError } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  });
  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      return { error: "An account with this email already exists. Please sign in." };
    }
    return { error: "Failed to create account. Please try again." };
  }
  if (!newAuth.user) return { error: "Failed to create account." };

  // Create Prisma user linked to the org
  await prisma.user.create({
    data: {
      id:             newAuth.user.id,
      email:          invite.email,
      firstName,
      lastName,
      role:           invite.role,
      organizationId: invite.organizationId,
    },
  });

  // Mark invitation as used
  await prisma.invitation.update({
    where: { id: invite.id },
    data:  { usedAt: new Date() },
  });

  // Sign the new user in so they land on the dashboard
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: invite.email, password });

  redirect("/dashboard");
}
