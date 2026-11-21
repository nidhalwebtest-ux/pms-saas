"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

export type UploadMediaResult = { ok: true; url: string } | { ok: false; error: string };

/** Folders the uploader is allowed to write to (under the public pms-media bucket). */
const ALLOWED_PREFIXES = ["units/", "properties/", "tenants/", "expenses/", "sites/"];

/**
 * Upload an image to the `pms-media` bucket SERVER-SIDE via the service-role
 * client. The browser/anon client is blocked by storage RLS for these prefixes
 * ("new row violates row-level security policy"), so we authenticate the caller
 * (must be an org user) and then bypass RLS safely here. Mirrors the expenses
 * receipt upload pattern.
 */
export async function uploadMedia(formData: FormData): Promise<UploadMediaResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  const folder = String(formData.get("folder") || "").replace(/^\/+|\/+$/g, "");
  if (!folder || folder.includes("..") || !ALLOWED_PREFIXES.some((p) => folder.startsWith(p))) {
    return { ok: false, error: "bad_folder" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "too_large" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "not_image" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("pms-media")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    console.error("[uploadMedia] storage error:", error);
    return { ok: false, error: "upload_failed" };
  }

  const { data } = admin.storage.from("pms-media").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Best-effort server-side delete of a previously-uploaded media URL. */
export async function deleteMedia(url: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const path = url.split("/pms-media/")[1];
  if (!path) return { ok: false };

  const admin = createAdminClient();
  await admin.storage.from("pms-media").remove([path]);
  return { ok: true };
}
