"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canNav, type Role } from "@/lib/permissions";

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

  const role = (dbUser.role ?? "STAFF") as Role;
  if (!canNav(role, "settings")) {
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

  // Contract gate (QA #24).
  const requireContractBeforeCheckIn = formData.get("requireContractBeforeCheckIn") === "on";
  const requireContractScope = formData.get("requireContractScope") === "ALL" ? "ALL" : "MONTHLY";
  const autoCreateContractOnConfirm = formData.get("autoCreateContractOnConfirm") === "on";

  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data:  {
        checkInPolicy, allowEarlyCheckIn, autoCheckout,
        reservationNumberPrefix, reservationNumberPadding, reservationNumberResetYearly,
        requireContractBeforeCheckIn, requireContractScope, autoCreateContractOnConfirm,
      },
    });
  } catch (err) {
    console.error("[updateReservationSettings] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard/settings/reservations");
  return { ok: true };
}
