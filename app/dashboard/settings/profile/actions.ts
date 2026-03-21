"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const user = await getAuthUser();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName  = (formData.get("lastName")  as string)?.trim();
  const phone     = (formData.get("phone")     as string)?.trim();

  if (!firstName) return { error: "First name is required." };

  await prisma.user.update({
    where: { id: user.id },
    data:  { firstName, lastName: lastName || null, phone: phone || null },
  });

  revalidatePath("/dashboard", "layout");
  return { success: "Profile updated successfully." };
}

// ── Change password ───────────────────────────────────────────────────────────

export async function changePassword(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user      = await getAuthUser();
  const supabase  = await createClient();

  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newPassword     = (formData.get("newPassword")     as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }
  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current one." };
  }

  // Verify current password by attempting sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email:    user.email!,
    password: currentPassword,
  });
  if (verifyError) return { error: "Current password is incorrect." };

  // Update via admin client (avoids session side-effects from sign-in above)
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) return { error: "Failed to update password. Please try again." };

  return { success: "Password changed successfully." };
}
