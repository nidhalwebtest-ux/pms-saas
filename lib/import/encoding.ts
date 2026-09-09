/* ============================================================================
 *  Encoding detection — CSV files from Arabic-locale Windows Excel are very
 *  commonly saved as Windows-1256, not UTF-8. Getting this wrong turns Arabic
 *  names into mojibake on import with no error raised (the bytes are still
 *  "valid" as some encoding, just the wrong one), so detection defaults to a
 *  safe heuristic and the wizard always lets the user override it manually.
 *
 *  Node's built-in TextDecoder (ICU-backed) decodes "windows-1256" directly —
 *  no extra dependency needed. Confirmed via /tmp fixture round-trip test.
 * ========================================================================= */

export type DetectedEncoding = "utf-8" | "utf-8-bom" | "windows-1256";

const UTF8_BOM = [0xef, 0xbb, 0xbf];

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === UTF8_BOM[0] && bytes[1] === UTF8_BOM[1] && bytes[2] === UTF8_BOM[2];
}

/** Strict UTF-8 validity check — throws internally on invalid sequences, which we catch. */
function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the encoding of a raw file buffer.
 *   1. UTF-8 BOM present → utf-8-bom (strip BOM, decode as UTF-8).
 *   2. Valid strict UTF-8 (no BOM) → utf-8.
 *   3. Otherwise → windows-1256 (the dominant legacy Arabic-Windows encoding;
 *      byte sequences that are invalid UTF-8 but were produced by Excel on a
 *      Windows machine with Arabic regional settings are, in practice, almost
 *      always this).
 * The wizard surfaces the detected value and lets the user override it, since
 * heuristic detection between arbitrary encodings can't be 100% certain.
 */
export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  if (hasUtf8Bom(bytes)) return "utf-8-bom";
  if (isValidUtf8(bytes)) return "utf-8";
  return "windows-1256";
}

export function decodeFileBuffer(bytes: Uint8Array, encoding?: DetectedEncoding): string {
  const enc = encoding ?? detectEncoding(bytes);
  if (enc === "utf-8-bom") {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  if (enc === "windows-1256") {
    return new TextDecoder("windows-1256").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}
