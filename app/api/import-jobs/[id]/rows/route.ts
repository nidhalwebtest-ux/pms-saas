import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import type { ImportRowStatus } from "@prisma/client";

// ── GET /api/import-jobs/[id]/rows?status=ERROR — paginated row listing ───────
// Backs the Step 4 errors table (filter by status) and any "view rows" UI.

export async function GET(
  req: NextRequest,
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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ImportRowStatus | null;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const where = { jobId: job.id, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.importJobRow.findMany({
      where,
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.importJobRow.count({ where }),
  ]);

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      rowNumber: r.rowNumber,
      rawData: r.rawData,
      status: r.status,
      errorMessage: r.errorMessage,
      createdEntityId: r.createdEntityId,
    })),
    total,
    page,
    pageSize,
  });
}
