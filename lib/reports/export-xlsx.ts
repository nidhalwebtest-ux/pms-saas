/**
 * Shared client-side Excel (.xlsx) exporter for the Reports module.
 *
 * Every report already builds a 2-D `rows` array (header row + data rows, the
 * same shape it used for CSV). This turns that array into a real .xlsx via
 * SheetJS — numbers become numeric cells (so they sum in Excel), OMR amounts get
 * a 3-decimal format, and columns are auto-sized. The library is dynamically
 * imported so it only loads when the user actually clicks Export.
 */

type Cell = string | number;

const MONEY = /^-?\d+\.\d{3}$/;        // 1925.000, -516.000  → numeric, 3-decimals
const INT   = /^-?(0|[1-9]\d*)$/;      // 20, 0, -3           → numeric (no leading-zero codes)

function autoWidths(rows: Cell[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((v, c) => {
      const len = String(v ?? "").length;
      if (len > (widths[c] ?? 0)) widths[c] = len;
    });
  }
  return widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 8), 48) }));
}

export async function downloadXlsx(
  rows: Cell[][],
  filename: string,
  sheetName = "Report",
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Coerce numeric-looking string cells to real numbers (money keeps 3 decimals).
  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell || typeof cell.v !== "string") continue;
        const s = cell.v.trim();
        if (MONEY.test(s)) { cell.t = "n"; cell.v = Number(s); cell.z = "#,##0.000"; delete cell.w; }
        else if (INT.test(s)) { cell.t = "n"; cell.v = Number(s); delete cell.w; }
      }
    }
  }

  ws["!cols"] = autoWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
