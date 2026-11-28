"use client";

import { createClient } from "@/utils/supabase/client";
import { createBlogUploadTicket } from "@/app/(main)/(admin)/admin/blog/actions";

/**
 * Upload an image/video for the blog straight from the browser to Supabase
 * Storage, using a signed URL issued by the server after the super-admin check.
 * Resolves to the public URL; throws an Error with a readable message.
 */
export async function uploadBlogMedia(file: File): Promise<string> {
  const ticket = await createBlogUploadTicket({ name: file.name, type: file.type, size: file.size });
  if (!ticket.ok) throw new Error(ticket.error);
  const { error } = await createClient()
    .storage.from("pms-media")
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message || "Upload failed");
  return ticket.publicUrl;
}
