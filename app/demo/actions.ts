"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { LOCALE_COOKIE } from "@/i18n/config";
import { seedDemoOrg } from "@/scripts/_seed/demo-data";

export type DemoResult = { ok: true } | { ok: false; error: string };

/**
 * Demo Tour entry point. Creates (or resumes) a fully-seeded, self-contained
 * demo organization for a visitor who provides only a name + WhatsApp number,
 * signs them straight into the dashboard — no email, password, or
 * verification step. Mirrors the auth pattern already used for team-invite
 * acceptance (app/invite/[token]/actions.ts): admin-create a pre-confirmed
 * Supabase user, create the Prisma User + Organization, sign in server-side.
 */
export async function startDemo(
  _prev: DemoResult,
  formData: FormData,
): Promise<DemoResult> {
  const name = (formData.get("name") as string)?.trim();
  const whatsapp = (formData.get("whatsapp") as string)?.trim();

  if (!name) return { ok: false, error: "name_required" };
  if (!whatsapp || !whatsapp.startsWith("+")) {
    return { ok: false, error: "whatsapp_invalid" };
  }

  // ── Rate limit by IP ─────────────────────────────────────────────────────
  const h = await headers();
  const ip = clientIp(h);
  const { ok: withinLimit } = await rateLimit("demo-start", ip, {
    tokens: 5,
    window: "10 m",
  });
  if (!withinLimit) return { ok: false, error: "rate_limited" };

  // ── Resume an existing demo for this WhatsApp number instead of creating
  //    a duplicate ───────────────────────────────────────────────────────
  const existingDemo = await prisma.organization.findFirst({
    where: { isDemo: true, demoContactWhatsapp: whatsapp },
    select: { id: true, users: { select: { id: true, email: true }, take: 1 } },
  });

  const supabase = await createClient();

  if (existingDemo?.users[0]) {
    const signInError = await signInDemoUser(supabase, existingDemo.users[0].id);
    if (signInError) return { ok: false, error: "server_error" };
    await setArabicLocale();
    redirect("/dashboard");
  }

  // ── Create a brand-new demo org + user ──────────────────────────────────
  const admin = createAdminClient();
  const demoEmail = `demo-${crypto.randomUUID()}@internal.binaya.app`;
  const demoPassword = crypto.randomUUID();

  const { data: newAuth, error: authError } = await admin.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { isDemo: true, displayName: name, whatsapp },
  });
  if (authError || !newAuth.user) {
    console.error("[startDemo] auth create failed:", authError);
    return { ok: false, error: "server_error" };
  }

  let orgId: string;
  try {
    const org = await prisma.organization.create({
      data: {
        name: `${name} — Demo`,
        currency: "OMR",
        city: "Salalah",
        plan: "FREE",
        isDemo: true,
        demoCreatedAt: new Date(),
        demoContactName: name,
        demoContactWhatsapp: whatsapp,
        users: {
          create: {
            id: newAuth.user.id,
            email: demoEmail,
            firstName: name,
            role: "OWNER",
            preferredLanguage: "ar",
          },
        },
      },
    });
    orgId = org.id;
  } catch (err) {
    console.error("[startDemo] org create failed:", err);
    await admin.auth.admin.deleteUser(newAuth.user.id).catch(() => {});
    return { ok: false, error: "server_error" };
  }

  // Seeding must complete before we sign the visitor in — an empty demo
  // dashboard is worse than no demo at all, so a seeding failure fails the
  // whole attempt rather than silently landing them in a blank org.
  try {
    await seedDemoOrg(orgId, newAuth.user.id);
  } catch (err) {
    console.error("[startDemo] seeding failed:", err);
    await admin.auth.admin.deleteUser(newAuth.user.id).catch(() => {});
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    return { ok: false, error: "server_error" };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });
  if (signInError) {
    console.error("[startDemo] sign-in failed:", signInError);
    return { ok: false, error: "server_error" };
  }

  await setArabicLocale();
  redirect("/dashboard");
}

async function signInDemoUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  // Resuming an existing demo requires a fresh session for that same
  // Supabase Auth user. We don't store the original password, so we mint a
  // new one via the admin API and sign in with it immediately.
  const admin = createAdminClient();
  const newPassword = crypto.randomUUID();
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    userId,
    { password: newPassword },
  );
  if (updateError || !updated.user?.email) return true;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: updated.user.email,
    password: newPassword,
  });
  return Boolean(signInError);
}

async function setArabicLocale() {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, "ar", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
