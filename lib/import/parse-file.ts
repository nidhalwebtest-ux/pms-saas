import * as XLSX from "xlsx";
import { decodeFileBuffer, detectEncoding, type DetectedEncoding } from "./encoding";

/* ============================================================================
 *  File parsing — accepts .csv or .xlsx, returns headers + string rows.
 *
 *  Everything downstream (mapping, validation, import) works on plain
 *  string cell values regardless of source format — xlsx cells are coerced
 *  to their displayed string form so "120.500" and 120.5 both flow through
 *  the same string-based parseRow() logic in each adapter.
 * ========================================================================= */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS = 5000;

export interface ParsedFile {
  headers: string[];
  /** Data rows only (header excluded), each a header→cell map. */
  rows: Record<string, string>[];
  rowCount: number;
  encoding: DetectedEncoding | "n/a (xlsx)";
  format: "csv" | "xlsx";
  /**
   * True if the source file contained at least one live formula cell (only
   * possible for .xlsx — CSV cells are always parsed as literal text; see
   * the `raw: true` read option below). A formula cell has no fixed value
   * without evaluation, so it comes back as an empty string in `rows` — this
   * flag lets the caller warn the user explicitly instead of that happening
   * silently.
   */
  hasFormulaCells: boolean;
}

export type ParseFileError =
  | { code: "TOO_LARGE"; maxBytes: number }
  | { code: "TOO_MANY_ROWS"; maxRows: number; actual: number }
  | { code: "EMPTY_FILE" }
  | { code: "NO_HEADERS" }
  | { code: "UNSUPPORTED_FORMAT" }
  | { code: "PARSE_FAILED"; message: string };

export type ParseFileResult =
  | { ok: true; file: ParsedFile }
  | { ok: false; error: ParseFileError };

function sniffFormat(filename: string, bytes: Uint8Array): "csv" | "xlsx" {
  // xlsx files are zip archives — magic bytes "PK\x03\x04". Sniff content, not
  // just the extension, per the security requirement (validate by content).
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "xlsx";
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  // Fall back to treating unrecognized-but-not-zip content as CSV text.
  return "csv";
}

function aoaToRows(aoa: unknown[][]): { headers: string[]; rows: Record<string, string>[] } {
  const [headerRow, ...dataRows] = aoa;
  const headers = (headerRow ?? []).map((h) => String(h ?? "").trim());
  const rows = dataRows
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = String(r[i] ?? "").trim();
      });
      return obj;
    });
  return { headers, rows };
}

/**
 * True if any cell in the sheet is a live formula (type "n"/"s"/etc. with an
 * `f` property) whose value SheetJS couldn't resolve to a display string —
 * i.e. it would silently come back as "" from sheet_to_json. Used to flag
 * genuine .xlsx formula cells (which XLSX.read's `raw` option cannot
 * suppress — formulas are structural in the binary format, unlike CSV where
 * `=`-prefixed text is just a string SheetJS misinterprets) rather than
 * letting them disappear with no signal.
 */
function hasUnresolvedFormulaCells(sheet: XLSX.WorkSheet): boolean {
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith("!")) continue;
    const cell = sheet[addr];
    if (cell && typeof cell === "object" && "f" in cell && cell.v === undefined) {
      return true;
    }
  }
  return false;
}

export function parseFile(filename: string, buffer: Uint8Array, encodingOverride?: DetectedEncoding): ParseFileResult {
  if (buffer.byteLength === 0) return { ok: false, error: { code: "EMPTY_FILE" } };
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: { code: "TOO_LARGE", maxBytes: MAX_FILE_BYTES } };
  }

  const format = sniffFormat(filename, buffer);

  try {
    let headers: string[];
    let rows: Record<string, string>[];
    let encoding: DetectedEncoding | "n/a (xlsx)";
    let hasFormulaCells: boolean;

    if (format === "xlsx") {
      // A real .xlsx formula cell (e.g. a user's own =SUM(...)) is structural
      // to the binary format — `raw` here doesn't suppress formula parsing,
      // only numeric formatting. We don't evaluate formulas (that's its own
      // risk surface); hasUnresolvedFormulaCells lets the caller warn the
      // user explicitly rather than the cell silently coming back as "".
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      hasFormulaCells = hasUnresolvedFormulaCells(sheet);
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      ({ headers, rows } = aoaToRows(aoa));
      encoding = "n/a (xlsx)";
    } else {
      encoding = encodingOverride ?? detectEncoding(buffer);
      const text = decodeFileBuffer(buffer, encoding);
      // `raw: true` at READ time (not sheet_to_json time) keeps every CSV
      // cell as a literal string, so a value like "=1+1" or "=HYPERLINK(...)"
      // is never parsed as a live formula and silently blanked — it reaches
      // the rest of the pipeline exactly as typed. Values are NOT formula-
      // sanitized here (or when stored as ImportJobRow.rawData) — sanitizing
      // this early corrupted legitimate values like phone numbers starting
      // with "+". Sanitization only happens at CSV *export* time
      // (csv-writer.ts's buildErrorCsv), the one place a value is ever
      // re-opened in a spreadsheet app. CSV cells can never carry a *real*
      // formula (there's no spreadsheet engine backing a .csv), so raw:true
      // is safe for every legitimate value too — confirmed numeric/date
      // formatting via sheet_to_json's own `raw: false` is unaffected by the
      // read-time flag.
      const wb = XLSX.read(text, { type: "string", raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      hasFormulaCells = false;
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
      ({ headers, rows } = aoaToRows(aoa));
    }

    if (headers.length === 0 || headers.every((h) => h === "")) {
      return { ok: false, error: { code: "NO_HEADERS" } };
    }
    if (rows.length > MAX_ROWS) {
      return { ok: false, error: { code: "TOO_MANY_ROWS", maxRows: MAX_ROWS, actual: rows.length } };
    }

    return { ok: true, file: { headers, rows, rowCount: rows.length, encoding, format, hasFormulaCells } };
  } catch (e) {
    return { ok: false, error: { code: "PARSE_FAILED", message: e instanceof Error ? e.message : String(e) } };
  }
}
