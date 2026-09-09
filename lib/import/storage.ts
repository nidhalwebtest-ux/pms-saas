import { createAdminClient } from "@/utils/supabase/admin";

/* ============================================================================
 *  Import file storage — reuses the pms-media bucket (server-side admin
 *  client, same pattern as uploadMedia/uploadReceipt) but keeps import files
 *  out of getPublicUrl(): source CSVs and error reports carry tenant PII
 *  (phone numbers, ID numbers), so they're only ever served back through an
 *  authenticated route that re-checks the requester's organizationId against
 *  the owning job — never a guessable public URL.
 * ========================================================================= */

const BUCKET = "pms-media";

export function importSourcePath(organizationId: string, jobId: string, ext: string): string {
  return `imports/${organizationId}/${jobId}/source.${ext}`;
}

export function importErrorPath(organizationId: string, jobId: string): string {
  return `imports/${organizationId}/${jobId}/errors.csv`;
}

export async function uploadImportFile(path: string, buffer: Buffer, contentType: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (error) {
    console.error("[uploadImportFile] storage error:", error);
    return { ok: false, error: "upload_failed" };
  }
  return { ok: true };
}

export async function downloadImportFile(path: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
