import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { getAdapter } from "@/lib/import/registry";

// ── GET /api/import-jobs/[id]/undo — preview: how many records would be deleted ─

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

  const successRows = await prisma.importJobRow.findMany({
    where: { jobId: job.id, status: "SUCCESS", createdEntityId: { not: null } },
    select: { id: true, createdEntityId: true },
  });

  return NextResponse.json({ eligibleCount: successRows.length });
}

// ── POST /api/import-jobs/[id]/undo — delete every record this job created ────
// Row-by-row: a row whose entity has dependents (e.g. a building with active
// reservations) is refused with a clear reason and left in place; everything
// else is deleted. Reports exactly what happened so nothing is a silent
// partial failure.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __denied = await forbiddenIfNo("dataImport", "FULL");
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
  if (!["COMPLETED", "COMPLETED_WITH_ERRORS", "CANCELLED"].includes(job.status)) {
    return NextResponse.json({ error: "job_not_undoable" }, { status: 400 });
  }

  const adapter = getAdapter(job.recordType);
  const successRows = await prisma.importJobRow.findMany({
    where: { jobId: job.id, status: "SUCCESS", createdEntityId: { not: null } },
    select: { id: true, createdEntityId: true },
  });

  let deleted = 0;
  let blocked = 0;
  const blockedReasons: { rowId: string; reason: string }[] = [];

  for (const row of successRows) {
    try {
      await adapter.undoRow(row.createdEntityId!, orgUser.organizationId);
      deleted++;
      await prisma.importJobRow.update({ where: { id: row.id }, data: { status: "SKIPPED", createdEntityId: null } });
    } catch (e) {
      blocked++;
      const reason = e instanceof Error ? e.message : "undo_failed";
      blockedReasons.push({ rowId: row.id, reason });
    }
  }

  return NextResponse.json({ deleted, blocked, blockedReasons });
}
