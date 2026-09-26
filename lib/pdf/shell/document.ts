import { buildPdfBaseStyles, type PdfStyleOptions } from "./style";

export interface PdfDocumentOptions extends PdfStyleOptions {
  lang: string;
  title: string;
  /** Route-assembled HTML for everything between header and footer. */
  body: string;
  /** Extra CSS specific to this one document (should shrink toward empty as more gets promoted into the shell). */
  extraStyles?: string;
}

/**
 * Top-level <html> assembler. Owns only the truly universal skeleton —
 * section order/presence genuinely differs per document (expense has no
 * items table; reservation has a 4-col grid + signatures), so that stays
 * route-owned; this just wires together the shared <style> and wraps
 * whatever body HTML the route already assembled from the other builders.
 */
export function renderPdfDocument(opts: PdfDocumentOptions): string {
  const { lang, dir, title, body, extraStyles, ...styleOpts } = opts;
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  ${buildPdfBaseStyles({ dir, ...styleOpts })}
  ${extraStyles ?? ""}
</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}
