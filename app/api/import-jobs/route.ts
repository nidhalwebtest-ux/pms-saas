import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { IMPORT_ADAPTERS } from "@/lib/import/registry";
import type { ImportRecordType } from "@prisma/client";

// ── GET /api/import-jobs — history list ───────────────────────────────────────

export async function GET() {
  const __denied = await forbiddenIfNo("dataImport", "VIEW");
  if (__denied) return __denied;
  let orgUser;
  try {
    orgUser = await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const jobs = await prisma.importJob.findMany({
    where: { organizationId: orgUser.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, recordType: true, status: true, originalFilename: true,
      totalRows: true, processedRows: true, successRows: true, errorRows: true,
      errorFilePath: true, parentJobId: true,
      startedAt: true, finishedAt: true, createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      startedAt: j.startedAt?.toISOString() ?? null,
      finishedAt: j.finishedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
      createdByName: j.createdBy ? `${j.createdBy.firstName ?? ""} ${j.createdBy.lastName ?? ""}`.trim() : null,
    })),
  });
}

// ── POST /api/import-jobs — create a job for a record type ────────────────────

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const recordType = body.recordType as ImportRecordType;
  if (!IMPORT_ADAPTERS.some((a) => a.recordType === recordType)) {
    return NextResponse.json({ error: "invalid_record_type" }, { status: 400 });
  }

  const job = await prisma.importJob.create({
    data: {
      organizationId: orgUser.organizationId,
      createdById: orgUser.userId,
      recordType,
      status: "PENDING",
      originalFilename: "",
      storagePath: "",
    },
  });

  return NextResponse.json({ id: job.id });
}
