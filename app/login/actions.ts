"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    redirect("/login?error=invalid_credentials");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();

    // User exists but hasn't confirmed their email yet
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    // Wrong password / email combination
    if (msg.includes("invalid") || msg.includes("credentials") || error.status === 400) {
      redirect("/login?error=invalid_credentials");
    }

    redirect("/login?error=server_error");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    redirect("/login?error=invalid_credentials");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("already registered") || msg.includes("already exists") || error.status === 422) {
      redirect("/login?error=email_exists");
    }

    redirect("/login?error=server_error");
  }

  // Always send to verify-email — Supabase will either send a confirmation email
  // (if email confirmation is ON) or activate the account immediately.
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// NOTE: Enable Google provider in Supabase → Authentication → Providers → Google.
// Add your Google Cloud OAuth Client ID & Secret, and set the redirect URL in
// your Google Cloud console to: {SITE_URL}/auth/callback

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${SITE_URL}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth_error");
  }

  // data.url is the Google consent page URL — redirect user there
  redirect(data.url);
}