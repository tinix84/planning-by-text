import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { compile } from "../src/compile.ts";
import { writeXlsx } from "../src/xlsx.ts";

test("spreadsheet status hours and active bookings agree with forecast totals", async () => {
  const r = compile([
    { path: "registry.pbt", text: "calendar TEST 8h/d 100h/m\nperson @alice role:HW loc:TEST\nproject +ALPHA 2024-01\n+ALPHA.task" },
    { path: "projects/a.pbt", text: "@alice +ALPHA 100% 2024-01\n@alice +ALPHA.task 25% 2024-01" },
    { path: "teams/t.pbt", text: "@alice +ALPHA 100% 2024-01" },
  ]);
  const out = join(mkdtempSync(join(tmpdir(), "pbt-status-")), "status.xlsx");
  await writeXlsx(r.model, r.diagnostics, out);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(out);
  const hours: Record<string, ExcelJS.CellValue> = {};
  wb.getWorksheet("Hours")!.eachRow((row, n) => {
    if (n > 1) hours[String(row.getCell(3).value)] = row.getCell(4).value;
  });
  assert.deepEqual(hours, { booked: 100, capacity: 100, confirmed: 75, requested: 25, unspecified: 0 });
  assert.equal(wb.getWorksheet("Bookings")!.rowCount, 3);
  assert.equal(wb.getWorksheet("RoleBalance")!.getRow(3).getCell(4).value, 100);
});
