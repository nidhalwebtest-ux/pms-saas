import { NextRequest, NextResponse } from "next/server";
import { forbiddenIfNo } from "@/lib/access";
import { requireOrgUser } from "@/lib/tenant";
import { getAdapter } from "@/lib/import/registry";
import { sanitizeCsvCell } from "@/lib/import/sanitize";
import type { ImportRecordType } from "@prisma/client";

function escapeCsvField(value: string): string {
  const sanitized = sanitizeCsvCell(value);
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

// ── GET /api/import-jobs/template?recordType=BUILDINGS&lang=en — CSV template ──

export async function GET(req: NextRequest) {
  const __denied = await forbiddenIfNo("dataImport", "VIEW");
  if (__denied) return __denied;
  try {
    await requireOrgUser();
  } catch (e: unknown) {
    return NextResponse.json(e, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get("recordType") as ImportRecordType | null;
  const lang = searchParams.get("lang") === "ar" ? "ar" : "en";
  if (!recordType) return NextResponse.json({ error: "missing_record_type" }, { status: 400 });

  let adapter;
  try {
    adapter = getAdapter(recordType);
  } catch {
    return NextResponse.json({ error: "invalid_record_type" }, { status: 400 });
  }

  // Header row uses the field's primary alias in the requested language (the
  // first Arabic alias for "ar", the field key itself for "en" — matches what
  // auto-map recognizes on re-upload, so a template round-trips through the
  // wizard's own auto-mapper with zero manual mapping needed).
  const headers = adapter.fields.map((f) => {
    if (lang === "ar") {
      const arAlias = f.aliases.find((a) => /[؀-ۿ]/.test(a));
      return arAlias ?? f.key;
    }
    return f.key;
  });

  const exampleRows = [0, 1].map((i) =>
    adapter.fields.map((f) => (lang === "ar" ? f.exampleAr[i] : f.exampleEn[i])),
  );

  const lines = [headers, ...exampleRows].map((cols) => cols.map(escapeCsvField).join(","));
  const csv = "\uFEFF" + lines.join("\r\n");

  return new Response(Buffer.from(csv, "utf-8"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${recordType.toLowerCase()}-template-${lang}.csv"`,
    },
  });
}
