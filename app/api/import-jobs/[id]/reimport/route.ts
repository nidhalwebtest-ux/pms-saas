import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getOwnedJob } from "@/lib/import/job-access";

// ── POST /api/import-jobs/[id]/reimport ────────────────────────────────────────
// Creates a new job pre-seeded with the parent's ERROR rows' raw_data and the
// same field mapping/options, so the user can fix the downloaded CSV in Excel
// and re-upload just those rows without redoing Step 1-3 mapping from scratch.
// The new job still requires its own file re-upload (the user's fixed CSV) —
// this seeds rowNumbers/expected count and skips straight to Step 2 with the
// mapping pre-filled; parentJobId links the two for the history view.

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

  const { ok } = await rateLimit("import-job-create", orgUser.organizationId, { tokens: 20, window: "1 m" });
  if (!ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  const parentJob = await getOwnedJob(id, orgUser.organizationId);
  if (!parentJob) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const errorCount = await prisma.importJobRow.count({ where: { jobId: parentJob.id, status: "ERROR" } });
  if (errorCount === 0) return NextResponse.json({ error: "no_error_rows" }, { status: 400 });

  const newJob = await prisma.importJob.create({
    data: {
      organizationId: orgUser.organizationId,
      createdById: orgUser.userId,
      recordType: parentJob.recordType,
      status: "PENDING",
      originalFilename: `${parentJob.originalFilename} (fixed)`,
      storagePath: "",
      fieldMapping: parentJob.fieldMapping as object,
      options: parentJob.options as object,
      parentJobId: parentJob.id,
    },
  });

  return NextResponse.json({ id: newJob.id });
}
