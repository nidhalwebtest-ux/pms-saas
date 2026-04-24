"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIE } from "@/i18n/config";
import { setAuthFlash } from "@/lib/auth-flash";

// ─── Rate-limit constants ──────────────────────────────────────────────────────
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

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

  if (!email || !password) {
    await setAuthFlash({ error: "invalid_credentials" });
    redirect("/login");
  }

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
    // Lockout ends 15 min after the oldest attempt in the limiting window
    const oldestAttempt = recentAttempts[MAX_ATTEMPTS - 1];
    const lockoutUntil  = oldestAttempt.createdAt.getTime() + WINDOW_MS;
    await setAuthFlash({ error: "too_many_attempts", lockoutUntil });
    redirect("/login");
  }

  // ── Attempt login ────────────────────────────────────────────────────────────
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Record the failure
    await prisma.loginAttempt.create({ data: { email } }).catch(() => {});

    const msg = error.message.toLowerCase();

    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    // After this failure, did we hit the limit?
    const newCount = recentAttempts.length + 1;
    if (newCount >= MAX_ATTEMPTS) {
      const lockoutUntil = Date.now() + WINDOW_MS;
      await setAuthFlash({ error: "too_many_attempts", lockoutUntil });
      redirect("/login");
    }

    if (msg.includes("invalid") || msg.includes("credentials") || error.status === 400) {
      await setAuthFlash({ error: "invalid_credentials" });
      redirect("/login");
    }
    await setAuthFlash({ error: "server_error" });
    redirect("/login");
  }

  // ── Success — clear attempts ──────────────────────────────────────────────────
  await prisma.loginAttempt.deleteMany({ where: { email } }).catch(() => {});

  // ── Honor stored language preference ─────────────────────────────────────────
  // After login, override the locale cookie with the user's saved preference
  // so the choice follows them across devices.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferredLanguage: true },
      });
      if (dbUser?.preferredLanguage) {
        cookieStore.set(LOCALE_COOKIE, dbUser.preferredLanguage, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
    }
  } catch { /* best-effort — fall back to existing cookie */ }

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

  if (!email || !password) {
    await setAuthFlash({ error: "invalid_credentials" });
    redirect("/login");
  }

  // Use admin generateLink — this creates the user AND returns the verification
  // URL in ONE call, without triggering Supabase's own email sending.
  // (calling signUp() first then generateLink() creates two tokens and the
  //  first one — sent by Supabase — immediately expires when the second is made)
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
      await setAuthFlash({ error: "email_exists" });
      redirect("/login");
    }
    console.error("[signup] generateLink error:", linkError.message);
    await setAuthFlash({ error: "server_error" });
    redirect("/login");
  }

  if (!linkData?.properties?.action_link) {
    await setAuthFlash({ error: "server_error" });
    redirect("/login");
  }

  // Send the single, valid verification link via Resend REST API — no SMTP.
  // If sending fails (most often: using onboarding@resend.dev to a non-owner
  // address, or an unverified domain), surface a warning to the user via the
  // flash cookie so they know to check spam, contact support, or use the
  // resend page once their address is allow-listed.
  let emailDelivered = true;
  try {
    await sendVerificationEmail(email, linkData.properties.action_link);
  } catch (err) {
    emailDelivered = false;
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[signup] Resend send failed:", detail);
  }

  if (!emailDelivered) {
    await setAuthFlash({ warn: "email_send_failed" });
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
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

  if (error || !data.url) {
    await setAuthFlash({ error: "oauth_error" });
    redirect("/login");
  }

  redirect(data.url);
}
