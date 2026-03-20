"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendVerificationEmail } from "@/lib/email";

/**
 * Derive the absolute origin from the incoming request headers.
 * Works correctly in every environment (local, Vercel preview, production)
 * without relying on build-time env variables.
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  // x-forwarded-proto is set by Vercel / reverse proxies in production
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) redirect("/login?error=invalid_credentials");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }
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
  const adminClient = createAdminClient();
  const origin      = await getOrigin();

  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) redirect("/login?error=invalid_credentials");

  // Use admin generateLink — this creates the user AND returns the verification
  // URL in ONE call, without triggering Supabase's own email sending.
  // (calling signUp() first then generateLink() creates two tokens and the
  //  first one —sent by Supabase— immediately expires when the second is made)
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (linkError) {
    const msg = linkError.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("already been registered")
    ) {
      redirect("/login?error=email_exists");
    }
    console.error("[signup] generateLink error:", linkError.message);
    redirect("/login?error=server_error");
  }

  if (!linkData?.properties?.action_link) {
    redirect("/login?error=server_error");
  }

  // Send the single, valid verification link via Resend REST API — no SMTP.
  try {
    await sendVerificationEmail(email, linkData.properties.action_link);
  } catch (err) {
    console.error("[signup] Resend send failed:", err);
    // Non-fatal: user can resend from the verify-email page.
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin   = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/login?error=oauth_error");

  redirect(data.url);
}