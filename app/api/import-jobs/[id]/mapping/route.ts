import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOwnedJob } from "@/lib/import/job-access";
import { getAdapter } from "@/lib/import/registry";
import { DEFAULT_IMPORT_OPTIONS, type FieldMapping, type ImportOptions } from "@/lib/import/types";

// ── PATCH /api/import-jobs/[id]/mapping — save confirmed Step 3 mapping ───────

export async function PATCH(
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

  const body = await req.json().catch(() => ({}));
  const mapping = body.mapping as FieldMapping;
  const options: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, ...(body.options ?? {}) };

  const adapter = getAdapter(job.recordType);
  const missingRequired = adapter.fields.filter((f) => f.required && !mapping[f.key]);
  if (missingRequired.length > 0) {
    return NextResponse.json(
      { error: "missing_required_fields", fields: missingRequired.map((f) => f.key) },
      { status: 400 },
    );
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      fieldMapping: mapping as Prisma.InputJsonValue,
      options: options as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true });
}
