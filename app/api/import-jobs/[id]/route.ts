import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { getOwnedJob } from "@/lib/import/job-access";

// ── GET /api/import-jobs/[id] — poll status/progress ───────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("dataImport", "VIEW");
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

  return NextResponse.json({
    id: job.id,
    recordType: job.recordType,
    status: job.status,
    originalFilename: job.originalFilename,
    errorFilePath: job.errorFilePath,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    errorRows: job.errorRows,
    fieldMapping: job.fieldMapping,
    options: job.options,
    parentJobId: job.parentJobId,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  });
}
