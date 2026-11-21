"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";

export type SavePaymentSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updatePaymentSettings(
  formData: FormData,
): Promise<SavePaymentSettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { role: true, organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  if (!(await hasAccess("settingsPayments", "EDIT"))) return { ok: false, error: "forbidden" };

  const raw = formData.get("overpaymentPolicy") as string;
  const overpaymentPolicy = ["BLOCK", "WARN", "ALLOW"].includes(raw) ? raw : "WARN";

  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data:  { overpaymentPolicy },
    });
  } catch (err) {
    console.error("[updatePaymentSettings] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard/settings/payments");
  return { ok: true };
}
