"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function acceptInvitation(
  token: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const t = await getTranslations("auth.invite.errors");

  const firstName       = (formData.get("firstName") as string)?.trim();
  const lastName        = (formData.get("lastName")  as string)?.trim() || null;
  const password        = (formData.get("password")  as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!firstName)                     return { error: t("firstNameRequired") };
  if (password.length < 8)            return { error: t("passwordTooShort") };
  if (password !== confirmPassword)   return { error: t("passwordsMismatch") };

  // Fetch and validate the invitation
  const invite = await prisma.invitation.findUnique({
    where:   { token },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invite)             return { error: t("notFound") };
  if (invite.usedAt)       return { error: t("alreadyUsed") };
  if (invite.cancelledAt)  return { error: t("cancelled") };
  if (invite.expiresAt < new Date()) return { error: t("expired") };

  // Check the email is not already registered in this org
  const existing = await prisma.user.findFirst({
    where: { email: invite.email, organizationId: invite.organizationId },
  });
  if (existing) return { error: t("alreadyExists") };

  const admin = createAdminClient();

  // Create Supabase auth user (auto-confirmed — no email verification needed)
  const { data: newAuth, error: authError } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  });
  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      return { error: t("alreadyExistsSignIn") };
    }
    return { error: t("createFailed") };
  }
  if (!newAuth.user) return { error: t("createFailedShort") };

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
