"use server";

import { createClient } from "@/utils/supabase/server";

export async function resendVerificationEmail(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!email?.trim()) return { error: "Email address is required." };

  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: {
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
      }/auth/callback`,
    },
  });

  if (error) {
    // Supabase rate-limits resend requests
    if (error.message.toLowerCase().includes("rate")) {
      return { error: "Too many requests. Please wait a minute and try again." };
    }
    return { error: "Could not resend the verification email. Please try again." };
  }

  return { success: true };
}