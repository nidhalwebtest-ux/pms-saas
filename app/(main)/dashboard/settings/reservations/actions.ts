"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";

export type SaveReservationSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateReservationSettings(
  formData: FormData,
): Promise<SaveReservationSettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { role: true, organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  if (!(await hasAccess("settingsReservations", "EDIT"))) {
    return { ok: false, error: "forbidden" };
  }

  const checkInPolicyRaw = formData.get("checkInPolicy") as string;
  const checkInPolicy =
    checkInPolicyRaw === "REQUIRE_VACANT" ? "REQUIRE_VACANT" : "ALLOW_BACK_TO_BACK";
  const allowEarlyCheckIn = formData.get("allowEarlyCheckIn") === "on";
  const autoCheckout      = formData.get("autoCheckout") === "on";

  // Reservation-number format (QA #29). Sanitize: prefix to A–Z/0–9 (fallback
  // "RES"), padding clamped to 1–10, reset-yearly boolean.
  const prefixRaw = (formData.get("reservationNumberPrefix") as string ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const reservationNumberPrefix  = prefixRaw.slice(0, 8) || "RES";
  const paddingRaw = parseInt(formData.get("reservationNumberPadding") as string, 10);
  const reservationNumberPadding = Math.min(Math.max(Number.isFinite(paddingRaw) ? paddingRaw : 5, 1), 10);
  const reservationNumberResetYearly = formData.get("reservationNumberResetYearly") === "on";

  // Invoice Settings (QA #43).
  const pick = (key: string, allowed: string[], fallback: string) => {
    const v = formData.get(key) as string;
    return allowed.includes(v) ? v : fallback;
  };
  const TIMINGS = ["ON_CREATE", "ON_CHECK_IN", "MANUAL"];
  const dailyInvoiceTiming       = pick("dailyInvoiceTiming", TIMINGS, "MANUAL");
  const monthlyInvoiceTiming     = pick("monthlyInvoiceTiming", TIMINGS, "MANUAL");
  const autoIssueOnCheckIn       = pick("autoIssueOnCheckIn", ["ALL_STARTED", "FIRST_ONLY", "NONE"], "ALL_STARTED");
  const requireInvoiceForCheckIn = pick("requireInvoiceForCheckIn", ["OFF", "DAILY", "MONTHLY", "BOTH"], "OFF");

  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data:  {
        checkInPolicy, allowEarlyCheckIn, autoCheckout,
        reservationNumberPrefix, reservationNumberPadding, reservationNumberResetYearly,
        dailyInvoiceTiming, monthlyInvoiceTiming, autoIssueOnCheckIn, requireInvoiceForCheckIn,
      },
    });
  } catch (err) {
    console.error("[updateReservationSettings] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard/settings/reservations");
  return { ok: true };
}
