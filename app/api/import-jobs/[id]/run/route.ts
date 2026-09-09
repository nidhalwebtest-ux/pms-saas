import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";

// ── POST /api/import-jobs/[id]/run — transition READY → RUNNING ───────────────
// Only marks intent; app/api/import-jobs/[id]/process-batch does the actual
// per-batch work, called repeatedly by the client (see lib/import/README
// architecture note — no background-job infra exists in this codebase yet).

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
  if (job.status !== "READY") {
    return NextResponse.json({ error: "job_not_ready" }, { status: 400 });
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
