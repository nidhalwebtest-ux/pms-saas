/* ============================================================================
 *  CSV formula-injection guard.
 *
 *  Excel/Sheets treats a leading =, +, -, @ (or tab/CR) as the start of a
 *  formula. A malicious cell like `=HYPERLINK(...)` or `@SUM(...)` can exfil
 *  data or run DDE commands when the file is later reopened. Applied both when
 *  a row is ingested (so nothing downstream ever handles a live formula) and
 *  again when generating the error-rows CSV (so re-opening it in Excel is
 *  safe even if the source file already contained one).
 * ========================================================================= */

const DANGEROUS_LEADING = ["=", "+", "-", "@", "\t", "\r"];

export function sanitizeCsvCell(value: string): string {
  if (value.length === 0) return value;
  if (DANGEROUS_LEADING.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}

export function sanitizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitizeCsvCell(v);
  }
  return out;
}
