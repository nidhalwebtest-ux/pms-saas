"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// ─── Rate-limit constants ──────────────────────────────────────────────────────
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

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
  const supabase    = await createClient();
  const cookieStore = await cookies();

  const email      = (formData.get("email")      as string | null)?.trim().toLowerCase() ?? "";
  const password   = (formData.get("password")   as string | null) ?? "";
  const rememberMe = formData.get("rememberMe") === "on";

  if (!email || !password) redirect("/login?error=invalid_credentials");

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Purge stale attempts (keep the table small)
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  }).catch(() => {});

  // Fetch the most recent MAX_ATTEMPTS failures for this email
  const recentAttempts = await prisma.loginAttempt.findMany({
    where: { email, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    take: MAX_ATTEMPTS,
  });

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    // Lockout ends 15 min after the 5th (oldest) attempt in the window
    const fifthAttempt  = recentAttempts[MAX_ATTEMPTS - 1];
    const lockoutUntil  = fifthAttempt.createdAt.getTime() + WINDOW_MS;
    redirect(`/login?error=too_many_attempts&until=${lockoutUntil}`);
  }

  // ── Attempt login ────────────────────────────────────────────────────────────
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Record the failure
    await prisma.loginAttempt.create({ data: { email } }).catch(() => {});

    const remaining = MAX_ATTEMPTS - (recentAttempts.length + 1);
    const msg = error.message.toLowerCase();

    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }
    if (msg.includes("invalid") || msg.includes("credentials") || error.status === 400) {
      // Pass remaining attempts so the UI can warn the user
      redirect(`/login?error=invalid_credentials&remaining=${Math.max(0, remaining)}`);
    }
    redirect("/login?error=server_error");
  }

  // ── Success — clear attempts ──────────────────────────────────────────────────
  await prisma.loginAttempt.deleteMany({ where: { email } }).catch(() => {});

  // ── Remember Me ───────────────────────────────────────────────────────────────
  // Supabase SSR sets sb-* cookies with maxAge = access-token lifetime (~1 h).
  // The middleware refreshes them, so the session stays alive while the user
  // is active. With "Remember Me" we extend those cookies to 30 days so the
  // session survives browser restarts for a full month.
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined; // 30 days | session

  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    cookieStore.set({
      name:     cookie.name,
      value:    cookie.value,
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      ...(maxAge !== undefined ? { maxAge } : {}),
    });
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