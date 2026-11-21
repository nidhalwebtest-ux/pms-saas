"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

// ── Shared helper ─────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// ── Update profile info ───────────────────────────────────────────────────────

export async function updateProfile(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const tErr  = await getTranslations("settings.profile.errors");
  const tOk   = await getTranslations("settings.profile.toasts");
  const user  = await getAuthUser();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName  = (formData.get("lastName")  as string)?.trim();
  const phone     = (formData.get("phone")     as string)?.trim();

  if (!firstName) return { error: tErr("firstNameRequired") };

  await prisma.user.update({
    where: { id: user.id },
    data:  { firstName, lastName: lastName || null, phone: phone || null },
  });

  revalidatePath("/dashboard", "layout");
  return { success: tOk("profileUpdated") };
}

// ── Change password ───────────────────────────────────────────────────────────

export async function changePassword(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const tErr      = await getTranslations("settings.profile.errors");
  const tOk       = await getTranslations("settings.profile.toasts");
  const user      = await getAuthUser();
  const supabase  = await createClient();

  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newPassword     = (formData.get("newPassword")     as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: tErr("allFieldsRequired") };
  }
  if (newPassword.length < 8) {
    return { error: tErr("passwordTooShort") };
  }
  if (newPassword !== confirmPassword) {
    return { error: tErr("passwordsMismatch") };
  }
  if (currentPassword === newPassword) {
    return { error: tErr("sameAsCurrent") };
  }

  // Verify current password by attempting sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email:    user.email!,
    password: currentPassword,
  });
  if (verifyError) return { error: tErr("currentIncorrect") };

  // Update via admin client (avoids session side-effects from sign-in above)
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) return { error: tErr("updateFailed") };

  return { success: tOk("passwordChanged") };
}
