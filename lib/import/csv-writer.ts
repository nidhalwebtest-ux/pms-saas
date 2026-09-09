import { sanitizeCsvCell } from "./sanitize";

/* ============================================================================
 *  CSV generation for the error-rows download. Mirrors the existing
 *  escapeCsvField convention (app/api/tenants/[id]/ledger/export-excel), plus
 *  formula-injection sanitization — a value like `=SUM(A1)` typed by a user
 *  into a CSV they later re-import must not execute when THIS error file is
 *  reopened in Excel either.
 * ========================================================================= */

function escapeCsvField(value: string): string {
  const sanitized = sanitizeCsvCell(value);
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Build "original columns + Error" CSV text. `rows` carries each failed row's
 * original header→value map (from ImportJobRow.rawData) plus its message.
 */
export function buildErrorCsv(
  headers: string[],
  rows: { rawData: Record<string, string>; errorMessage: string }[],
  errorColumnLabel: string,
): string {
  const lines = [[...headers, errorColumnLabel].map(escapeCsvField).join(",")];
  for (const row of rows) {
    const line = [...headers.map((h) => row.rawData[h] ?? ""), row.errorMessage].map(escapeCsvField).join(",");
    lines.push(line);
  }
  // UTF-8 BOM so Excel opens the re-download correctly (not misread as
  // Windows-1252) even though the ORIGINAL upload may have been Windows-1256 —
  // the error file is always written back out as UTF-8 for a clean round-trip.
  return "\uFEFF" + lines.join("\r\n");
}
