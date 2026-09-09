import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { getAdapter } from "@/lib/import/registry";
import type { FieldMapping, ImportOptions, ImportContext } from "@/lib/import/types";

// ── POST /api/import-jobs/[id]/validate — dry-run validation, no writes ───────

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
  if (!["PENDING", "READY", "FAILED"].includes(job.status)) {
    return NextResponse.json({ error: "job_not_validatable" }, { status: 400 });
  }

  await prisma.importJob.update({ where: { id: job.id }, data: { status: "VALIDATING" } });

  const adapter = getAdapter(job.recordType);
  const mapping = job.fieldMapping as FieldMapping;
  const options = job.options as unknown as ImportOptions;
  const ctx: ImportContext = {
    organizationId: orgUser.organizationId,
    userId: orgUser.userId,
    options,
    cache: new Map(),
  };

  const rows = await prisma.importJobRow.findMany({
    where: { jobId: job.id },
    orderBy: { rowNumber: "asc" },
  });

  let successCount = 0;
  let errorCount = 0;

  // Sequential (not Promise.all) — validateRow reads/populates ctx.cache
  // (e.g. existing-name sets) that later rows in the same batch depend on for
  // correct intra-file duplicate detection.
  for (const row of rows) {
    const raw = row.rawData as Record<string, string>;
    const parsed = adapter.parseRow(raw, mapping, options);

    if (!parsed.ok) {
      errorCount++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: formatFieldErrors(parsed.errors) },
      });
      continue;
    }

    const validationErrors = await adapter.validateRow(parsed.data, ctx);
    if (validationErrors.length > 0) {
      errorCount++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "ERROR", errorMessage: formatFieldErrors(validationErrors) },
      });
      continue;
    }

    successCount++;
    await prisma.importJobRow.update({ where: { id: row.id }, data: { status: "PENDING", errorMessage: null } });
  }

  const finalStatus = errorCount === rows.length && rows.length > 0 ? "FAILED" : "READY";
  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: finalStatus, successRows: successCount, errorRows: errorCount },
  });

  return NextResponse.json({
    status: finalStatus,
    totalRows: rows.length,
    validRows: successCount,
    errorRows: errorCount,
  });
}

function formatFieldErrors(errors: { field?: string; message: string }[]): string {
  return errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join("; ");
}
