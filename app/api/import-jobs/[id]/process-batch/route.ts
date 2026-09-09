import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { getAdapter } from "@/lib/import/registry";
import type { FieldMapping, ImportOptions, ImportContext } from "@/lib/import/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;

// ── POST /api/import-jobs/[id]/process-batch — process up to 50 pending rows ──
//
// Called repeatedly by the client while status === RUNNING (see Step 5 UI).
// Each row is independent: one bad row is recorded as an error row and the
// loop continues — nothing here aborts the batch or the job. Progress is
// persisted to the DB after every row, so a page refresh mid-run always shows
// the true current state (poll GET /api/import-jobs/[id]).

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

  // Cancel (checked between batches) or a job that's already finished — stop.
  if (job.status === "CANCELLED") {
    return NextResponse.json({ done: true, status: "CANCELLED" });
  }
  if (job.status !== "RUNNING") {
    return NextResponse.json({ error: "job_not_running" }, { status: 400 });
  }

  const adapter = getAdapter(job.recordType);
  const mapping = job.fieldMapping as FieldMapping;
  const options = job.options as unknown as ImportOptions;
  const ctx: ImportContext = {
    organizationId: orgUser.organizationId,
    userId: orgUser.userId,
    options,
    cache: new Map(),
  };

  const batch = await prisma.importJobRow.findMany({
    where: { jobId: job.id, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
    take: BATCH_SIZE,
  });

  if (batch.length === 0) {
    const finalStatus = job.errorRows > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: finalStatus, finishedAt: new Date() },
    });
    return NextResponse.json({ done: true, status: finalStatus });
  }

  let batchSuccess = 0;
  let batchError = 0;

  for (const row of batch) {
    const raw = row.rawData as Record<string, string>;
    const parsed = adapter.parseRow(raw, mapping, options);

    if (!parsed.ok) {
      batchError++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: parsed.errors.map((e) => e.message).join("; ") },
      });
      continue;
    }

    // Re-validate at run time (data may have changed since the dry run —
    // e.g. another row in this same job just created the building it depends
    // on, or a duplicate appeared). Each row's business-rule check (including
    // reservation double-booking) runs fresh here.
    const validationErrors = await adapter.validateRow(parsed.data, ctx);
    if (validationErrors.length > 0) {
      const allDuplicates = validationErrors.every((e) => e.message.includes("duplicate"));
      // "update" has no per-entity update path yet (V1 scope — see adapter
      // comments), so it falls back to the same silent-skip behavior as "skip"
      // rather than either erroring or silently double-creating.
      if (allDuplicates && (options.duplicateHandling === "skip" || options.duplicateHandling === "update")) {
        await prisma.importJobRow.update({ where: { id: row.id }, data: { status: "SKIPPED", errorMessage: "duplicate — skipped" } });
        continue;
      }
      batchError++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: validationErrors.map((e) => e.message).join("; ") },
      });
      continue;
    }

    try {
      const created = await adapter.createRow(parsed.data, ctx);
      batchSuccess++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "SUCCESS", createdEntityId: created.id, errorMessage: null },
      });
    } catch (e) {
      batchError++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: e instanceof Error ? e.message : "create_failed" },
      });
    }
  }

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      processedRows: { increment: batch.length },
      successRows: { increment: batchSuccess },
      errorRows: { increment: batchError },
    },
    select: { processedRows: true, successRows: true, errorRows: true, totalRows: true, status: true },
  });

  return NextResponse.json({ done: false, ...updated });
}
