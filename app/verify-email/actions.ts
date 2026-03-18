"use server";

import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!email?.trim()) return { error: "Email address is required." };

  const supabase = await createClient();
  const origin   = await getOrigin();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate")) {
      return { error: "Too many requests. Please wait a minute and try again." };
    }
    return { error: "Could not resend the verification email. Please try again." };
  }

  return { success: true };
}