import ExcelJS from "exceljs";

type PreviewValue = string | number | boolean | null;

function previewValue(value: ExcelJS.CellValue): PreviewValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) return previewValue(value.result as ExcelJS.CellValue);
  if ("text" in value && typeof value.text === "string") return value.text;
  return String(value);
}

export async function inspectWorkbook(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return {
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.actualRowCount,
      columnCount: sheet.actualColumnCount,
      preview: sheet.getRows(1, Math.min(10, sheet.actualRowCount))?.map((row) =>
        Array.from({ length: Math.min(12, sheet.actualColumnCount) }, (_, index) => previewValue(row.getCell(index + 1).value)),
      ) ?? [],
    })),
  };
}
