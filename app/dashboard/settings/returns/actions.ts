"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { canNav, type Role } from "@/lib/permissions";

export type SaveReturnSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateReturnSettings(
  formData: FormData,
): Promise<SaveReturnSettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { role: true, organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  const role = (dbUser.role ?? "STAFF") as Role;
  if (!canNav(role, "settings")) return { ok: false, error: "forbidden" };

  const draftRaw   = formData.get("returnDraftPolicy")   as string;
  const balanceRaw = formData.get("returnBalancePolicy") as string;
  const rateRaw    = formData.get("returnRateBasis")     as string;

  const returnDraftPolicy   = ["CANCEL", "CREDIT"].includes(draftRaw)        ? draftRaw   : "CANCEL";
  const returnBalancePolicy = ["NET", "GROSS"].includes(balanceRaw)          ? balanceRaw : "NET";
  const returnRateBasis     = ["CHARGED", "PRICE_LIST"].includes(rateRaw)    ? rateRaw    : "CHARGED";

  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data:  { returnDraftPolicy, returnBalancePolicy, returnRateBasis },
    });
  } catch (err) {
    console.error("[updateReturnSettings] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard/settings/returns");
  return { ok: true };
}
