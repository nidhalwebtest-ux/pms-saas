"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";

export type UploadReceiptResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Upload an expense receipt server-side via the service-role client. Client-side
 * uploads to the `pms-media` bucket are blocked by storage RLS for the
 * `expenses/` prefix; doing it here (admin client) bypasses RLS safely after we
 * verify the caller is an authenticated org user.
 */
export async function uploadReceipt(formData: FormData): Promise<UploadReceiptResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });
  if (!dbUser?.organizationId) return { ok: false, error: "no_org" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "too_large" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "not_image" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `expenses/${dbUser.organizationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("pms-media")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) {
    console.error("[uploadReceipt] storage error:", error);
    return { ok: false, error: "upload_failed" };
  }

  const { data } = admin.storage.from("pms-media").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Best-effort server-side delete of a receipt (also RLS-bound on the client). */
export async function deleteReceipt(url: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const path = url.split("/pms-media/")[1];
  if (!path || !path.startsWith("expenses/")) return { ok: false };

  const admin = createAdminClient();
  await admin.storage.from("pms-media").remove([path]);
  return { ok: true };
}
