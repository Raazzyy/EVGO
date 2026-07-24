import * as XLSX from "xlsx";

export interface XlsxSheet {
  name: string;
  rows: Record<string, unknown>[];
  /** Columns where values should stay as numbers (not coerced to string) */
  numericKeys?: string[];
}

/** Auto-calculate column widths based on header and cell content */
function calcColWidths(
  rows: Record<string, unknown>[],
  keys: string[],
): { wch: number }[] {
  return keys.map((key) => {
    const headerLen = key.length;
    const maxDataLen = rows.reduce((max, row) => {
      const v = row[key];
      const len =
        v == null ? 0 : typeof v === "number" ? String(v).length : String(v).length;
      return Math.max(max, len);
    }, 0);
    return { wch: Math.max(headerLen, maxDataLen) + 2 };
  });
}

/**
 * Build a worksheet from an array of row objects.
 * Numeric keys are written as numbers so Excel can sum/format them.
 */
function buildSheet(
  rows: Record<string, unknown>[],
  numericKeys: string[] = [],
): XLSX.WorkSheet {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([[]]);
  }

  const keys = Object.keys(rows[0]);
  const numericSet = new Set(numericKeys);

  // Build AOA (array of arrays): header row + data rows
  const aoa: unknown[][] = [
    keys, // header
    ...rows.map((row) =>
      keys.map((k) => {
        const v = row[k];
        if (numericSet.has(k) && typeof v === "number") return v;
        return v == null ? "" : String(v);
      }),
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply column widths
  ws["!cols"] = calcColWidths(rows, keys);

  // Style header row bold by setting the header cells' style hint
  // (SheetJS Community doesn't support rich styling, but column widths work fine)

  return ws;
}

/**
 * Export multiple sheets to an XLSX file and trigger a browser download.
 */
export function exportXlsx(filename: string, sheets: XlsxSheet[]): void {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const ws = buildSheet(sheet.rows, sheet.numericKeys ?? []);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  if (wb.SheetNames.length === 0) return;

  XLSX.writeFile(wb, filename);
}
