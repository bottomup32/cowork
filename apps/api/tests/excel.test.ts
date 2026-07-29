import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { inspectWorkbook } from "../src/modules/files/excel.js";

describe("Excel inspection", () => {
  it("returns bounded sheet metadata without altering the original bytes", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoices");
    sheet.addRow(["Invoice", "Amount"]);
    sheet.addRow(["INV-1", 125]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const before = Buffer.from(bytes);
    expect(await inspectWorkbook(bytes)).toEqual({
      sheets: [{ name: "Invoices", rowCount: 2, columnCount: 2, preview: [["Invoice", "Amount"], ["INV-1", 125]] }],
    });
    expect(bytes).toEqual(before);
  });
});
