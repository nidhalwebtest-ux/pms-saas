"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Extract all fields ──────────────────────────────────────────────────────
  const name     = (formData.get("name")     as string)?.trim();
  const phone    = (formData.get("phone")    as string)?.trim() || null;
  const address  = (formData.get("address")  as string)?.trim() || null;
  const city     = (formData.get("city")     as string)?.trim() || "Salalah";
  const area     = (formData.get("area")     as string)?.trim() || null;
  const timezone = (formData.get("timezone") as string) || "Asia/Muscat";
  const currency = (formData.get("currency") as string) || "OMR";
  const logoFile = formData.get("logo") as File | null;

  if (!name) redirect("/onboarding?error=name_required");

  // ── Upload logo if provided ─────────────────────────────────────────────────
  let logoUrl: string | null = null;
  if (logoFile && logoFile.size > 0) {
    const adminClient = createAdminClient();
    const ext  = logoFile.name.split(".").pop() ?? "png";
    const path = `logos/${user.id}/logo.${ext}`;
    const buffer = Buffer.from(await logoFile.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from("pms-media")
      .upload(path, buffer, {
        contentType: logoFile.type,
        upsert:      true,
      });

    if (!uploadError) {
      const { data: urlData } = adminClient.storage
        .from("pms-media")
        .getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }
  }

  // ── Ensure the user record exists (safety for failed triggers) ─────────────
  await prisma.user.upsert({
    where:  { id: user.id },
    update: {},
    create: { id: user.id, email: user.email!, role: "OWNER" },
  });

  // ── Create organization ────────────────────────────────────────────────────
  await prisma.organization.create({
    data: {
      name,
      phone,
      address,
      city,
      area,
      logo:     logoUrl,
      timezone,
      currency,
      plan:     "FREE",
      users:    { connect: { id: user.id } },
    },
  });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
