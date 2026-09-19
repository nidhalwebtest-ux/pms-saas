import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { getAdapter } from "@/lib/import/registry";
import { parseFile } from "@/lib/import/parse-file";
import { autoMapHeaders } from "@/lib/import/auto-map";
import { detectEncoding } from "@/lib/import/encoding";
import { uploadImportFile, importSourcePath } from "@/lib/import/storage";
import type { DetectedEncoding } from "@/lib/import/encoding";

const ALLOWED_CONTENT_SNIFFS = new Set(["text/csv", "text/plain", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"]);

// ── POST /api/import-jobs/[id]/upload — accept file, parse, preview ───────────

export async function POST(
  req: NextRequest,
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
  if (job.status !== "PENDING") {
    return NextResponse.json({ error: "job_not_pending" }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const encodingOverride = formData?.get("encoding") as DetectedEncoding | null;
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  // Validate by content-type sniff too (not just extension) — belt and suspenders
  // alongside parseFile()'s own magic-byte check for xlsx.
  if (file.type && !ALLOWED_CONTENT_SNIFFS.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedEncoding = encodingOverride ?? detectEncoding(buffer);
  const parsed = parseFile(file.name, buffer, detectedEncoding);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error.code, detail: parsed.error }, { status: 400 });
  }

  const adapter = getAdapter(job.recordType);
  const autoMap = autoMapHeaders(parsed.file.headers, adapter.fields);

  const ext = parsed.file.format === "xlsx" ? "xlsx" : "csv";
  const storagePath = importSourcePath(orgUser.organizationId, job.id, ext);
  const uploadResult = await uploadImportFile(storagePath, buffer, file.type || "application/octet-stream");
  if (!uploadResult.ok) {
    return NextResponse.json({ error: "storage_upload_failed" }, { status: 500 });
  }

  // Persist the parsed rows now (sanitized against formula injection) so
  // later steps (mapping confirm, validate, run) don't need the file again —
  // raw_data survives for exact error-file regeneration per the spec.
  await prisma.$transaction([
    prisma.importJobRow.deleteMany({ where: { jobId: job.id } }),
    prisma.importJob.update({
      where: { id: job.id },
      data: {
        originalFilename: file.name,
        storagePath,
        totalRows: parsed.file.rowCount,
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
        fieldMapping: autoMap.mapping,
      },
    }),
  ]);

  // rawData is stored exactly as parsed — NOT formula-sanitized here. It's
  // only ever read as plain string data (parseRow/validateRow) or written
  // back out as CSV (buildErrorCsv in csv-writer.ts, which does apply
  // sanitizeCsvCell — the correct place, since that's the only path where a
  // value is ever re-opened in a spreadsheet app). Sanitizing at ingestion
  // corrupted legitimate values that start with one of the 4 guarded
  // characters (notably "+" — e.g. every international phone number) before
  // any adapter ever saw them, baking a stray leading "'" into real data
  // like Tenant.phone.
  await prisma.importJobRow.createMany({
    data: parsed.file.rows.map((raw, i) => ({
      jobId: job.id,
      rowNumber: i + 1,
      rawData: raw,
      status: "PENDING" as const,
    })),
  });

  return NextResponse.json({
    headers: parsed.file.headers,
    previewRows: parsed.file.rows.slice(0, 5),
    rowCount: parsed.file.rowCount,
    encoding: parsed.file.encoding,
    format: parsed.file.format,
    mapping: autoMap.mapping,
    matchedFields: [...autoMap.matchedFields],
    unmatchedColumns: autoMap.unmatchedColumns,
    hasFormulaCells: parsed.file.hasFormulaCells,
  });
}
