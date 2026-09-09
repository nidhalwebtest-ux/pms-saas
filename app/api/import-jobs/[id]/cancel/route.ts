import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";

// ── POST /api/import-jobs/[id]/cancel — stop after the current batch ──────────
// process-batch checks status before starting its next batch and stops if
// CANCELLED; rows already processed (SUCCESS/ERROR) stand as-is.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("dataImport", "CREATE");
  if (__denied) return __denied;
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { id } = await params;
  const job = await getOwnedJob(id, orgUser.organizationId);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["RUNNING", "READY"].includes(job.status)) {
    return NextResponse.json({ error: "job_not_cancellable" }, { status: 400 });
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
