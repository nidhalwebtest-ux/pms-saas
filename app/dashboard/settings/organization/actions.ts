"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { canNav, type Role } from "@/lib/permissions";

export type SaveOrgResult =
  | { ok: true }
  | { ok: false; error: string; field?: "name" };

export async function updateOrganization(
  formData: FormData,
): Promise<SaveOrgResult> {
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

  // ── Extract ────────────────────────────────────────────────────────────────
  const name     = (formData.get("name")     as string)?.trim();
  const phone    = (formData.get("phone")    as string)?.trim() || null;
  const address  = (formData.get("address")  as string)?.trim() || null;
  const city     = (formData.get("city")     as string)?.trim();
  const area     = (formData.get("area")     as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string) || "Asia/Muscat";
  const currency = (formData.get("currency") as string) || "OMR";
  const logoFile = formData.get("logo") as File | null;
  const removeLogo = formData.get("removeLogo") === "1";

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!name) {
    return { ok: false, error: "name_required", field: "name" };
  }
  if (name.length > 100) {
    return { ok: false, error: "name_too_long", field: "name" };
  }
  if (!city) {
    return { ok: false, error: "city_required" };
  }

  const dup = await prisma.organization.findFirst({
    where:  {
      name: { equals: name, mode: "insensitive" },
      NOT:  { id: dbUser.organizationId },
    },
    select: { id: true },
  });
  if (dup) {
    return { ok: false, error: "duplicate_name", field: "name" };
  }

  // ── Logo upload (or removal) ───────────────────────────────────────────────
  let logoUrl: string | null | undefined = undefined; // undefined = leave unchanged
  if (removeLogo) {
    logoUrl = null;
  } else if (logoFile && logoFile.size > 0) {
    try {
      const adminClient = createAdminClient();
      const ext  = logoFile.name.split(".").pop() ?? "png";
      const path = `logos/${user.id}/logo.${ext}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const { error: uploadError } = await adminClient.storage
        .from("pms-media")
        .upload(path, buffer, { contentType: logoFile.type, upsert: true });
      if (!uploadError) {
        const { data: urlData } = adminClient.storage
          .from("pms-media")
          .getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }
    } catch (err) {
      console.error("[updateOrganization] logo upload failed:", err);
    }
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  try {
    await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data: {
        name,
        phone,
        address,
        city,
        area,
        timezone,
        currency,
        ...(logoUrl !== undefined ? { logo: logoUrl } : {}),
      },
    });
  } catch (err) {
    console.error("[updateOrganization] DB error:", err);
    return { ok: false, error: "generic" };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings/organization");
  return { ok: true };
}
