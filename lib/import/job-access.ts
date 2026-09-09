import { prisma } from "@/lib/prisma";
import type { ImportJob } from "@prisma/client";

/**
 * Loads a job and verifies it belongs to the caller's org. Every
 * /api/import-jobs/[id]/* route calls this first — a job id from another
 * organization must 404, never leak existence or data.
 */
export async function getOwnedJob(jobId: string, organizationId: string): Promise<ImportJob | null> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.organizationId !== organizationId) return null;
  return job;
}
