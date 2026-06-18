"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";

export type SaveUnitSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateUnitSettings(
  formData: FormData,
): Promise<SaveUnitSettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { role: true, organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  if (!(await hasAccess("settingsUnits", "EDIT"))) {
    return { ok: false, error: "forbidden" };
  }

  const showReservedStatus = formData.get("showReservedStatus") === "on";

  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data:  { showReservedStatus },
    });
  } catch (err) {
    console.error("[updateUnitSettings] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard/settings/units");
  revalidatePath("/dashboard/units", "layout");
  return { ok: true };
}
