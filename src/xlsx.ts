// Spreadsheet export, built from the same views as the HTML report.
import ExcelJS from "exceljs";
import { fmt } from "./dates.ts";
import type { Model } from "./compile.ts";
import type { Diag } from "./parse.ts";
import { loadPct, loadRows, monthHeaders, roleRows, treeRows } from "./views.ts";

export async function writeXlsx(model: Model, diags: Diag[], out: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const months = monthHeaders(model);
  const head = (ws: ExcelJS.Worksheet, cols: string[]) => {
    ws.addRow(cols).font = { bold: true };
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  };

  const d = wb.addWorksheet("Diagnostics");
  head(d, ["Level", "Code", "File", "Line", "Message"]);
  for (const x of diags) d.addRow([x.level, x.code, x.loc?.file ?? "", x.loc?.line ?? "", x.msg]);

  const load = wb.addWorksheet("Load");
  const hours = wb.addWorksheet("Hours");
  head(load, ["Person", "Role", "Capacity", ...months]);
  head(hours, ["Person", "Role", "Kind", ...months]);
  for (const r of loadRows(model)) {
    const row = load.addRow([r.person, r.role, r.cap, ...r.cells.map((c) => { const p = loadPct(c); return p === undefined ? null : isFinite(p) ? p : "∞"; })]);
    row.getCell(3).numFmt = "0%";
    for (let i = 4; i < 4 + months.length; i++) {
      const cell = row.getCell(i);
      cell.numFmt = "0%";
      if (typeof cell.value === "number" && cell.value > 1.005)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9DCD6" } };
    }
    hours.addRow([r.person, r.role, "booked", ...r.cells.map((c) => (c ? Math.round(c.hours * 10) / 10 : 0))]);
    hours.addRow([r.person, r.role, "capacity", ...r.cells.map((c) => (c ? Math.round(c.capHours * 10) / 10 : 0))]);
    for (const status of ["confirmed", "requested", "unspecified"] as const)
      hours.addRow([r.person, r.role, status, ...r.cells.map((c) => Math.round((c?.[status] ?? 0) * 10) / 10)]);
  }

  const rb = wb.addWorksheet("RoleBalance");
  head(rb, ["Root", "Role", "Kind", ...months]);
  for (const r of roleRows(model)) {
    rb.addRow([r.root, r.role, "demand", ...r.demand.map((v) => Math.round(v * 10) / 10)]);
    rb.addRow([r.root, r.role, "supply", ...r.supply.map((v) => Math.round(v * 10) / 10)]);
    rb.addRow([r.root, r.role, "gap", ...r.demand.map((v, i) => Math.round((r.supply[i] - v) * 10) / 10)]);
  }

  const t = wb.addWorksheet("Tasks");
  head(t, ["Path", "Depth", "Title", "Effort h", "Remaining h", "Roles", "Window", "Tags", "Declared", "Profile"]);
  for (const x of treeRows(model)) t.addRow([x.path, x.depth, x.title, x.effort, x.remaining, x.roles, x.window, x.tags, x.declared, x.profile]);

  const b = wb.addWorksheet("Bookings");
  head(b, ["Person", "Path", "Load", "Start", "End", "Status", "File", "Line"]);
  for (const x of model.bookings) {
    const row = b.addRow([x.person, x.path, x.pct, fmt(x.s), fmt(x.e), x.status, x.at.file, x.at.line]);
    row.getCell(3).numFmt = "0%";
  }

  for (const ws of wb.worksheets) ws.columns.forEach((c, i) => { c.width = i === 0 ? 28 : i < 3 ? 14 : 10; });
  await wb.xlsx.writeFile(out);
}
