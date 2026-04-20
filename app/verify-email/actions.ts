"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendVerificationEmail } from "@/lib/email";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host  = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  const t = await getTranslations("auth.verify");

  if (!email?.trim()) return { error: t("errorEmailRequired") };

  const adminClient = createAdminClient();
  const origin      = await getOrigin();

  // Generate a fresh verification link via admin API — no SMTP, no Supabase email.
  // We use type "magiclink" because we don't have the user's password here.
  // Clicking the link confirms the email AND starts the session — same end result.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim(),
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[resend] generateLink failed:", linkError?.message);
    return { error: t("errorGenerateFailed") };
  }

  // Send via Resend REST API directly — no SMTP.
  try {
    await sendVerificationEmail(email.trim(), linkData.properties.action_link);
    return { success: true };
  } catch (err) {
    console.error("[resend] Resend send failed:", err);
    return { error: t("errorSendFailed") };
  }
}