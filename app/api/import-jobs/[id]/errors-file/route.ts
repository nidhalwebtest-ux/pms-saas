import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { buildErrorCsv } from "@/lib/import/csv-writer";
import { uploadImportFile, importErrorPath } from "@/lib/import/storage";

// ── GET /api/import-jobs/[id]/errors-file — download "original + Error" CSV ───
// Regenerated from ImportJobRow.rawData every time (source of truth), so it's
// always exact even if this is the first request for it.

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

  const errorRows = await prisma.importJobRow.findMany({
    where: { jobId: job.id, status: "ERROR" },
    orderBy: { rowNumber: "asc" },
  });

  if (errorRows.length === 0) {
    return NextResponse.json({ error: "no_error_rows" }, { status: 404 });
  }

  const headers = Array.from(
    new Set(errorRows.flatMap((r) => Object.keys(r.rawData as Record<string, string>))),
  );

  const csv = buildErrorCsv(
    headers,
    errorRows.map((r) => ({ rawData: r.rawData as Record<string, string>, errorMessage: r.errorMessage ?? "" })),
    "Error",
  );

  // Best-effort cache to storage for the history page's download link — the
  // response below is authoritative either way.
  const path = importErrorPath(orgUser.organizationId, job.id);
  const buffer = Buffer.from(csv, "utf-8");
  const uploaded = await uploadImportFile(path, buffer, "text/csv");
  if (uploaded.ok && !job.errorFilePath) {
    await prisma.importJob.update({ where: { id: job.id }, data: { errorFilePath: path } });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${job.originalFilename.replace(/\.[^.]+$/, "")}-errors.csv"`,
    },
  });
}
