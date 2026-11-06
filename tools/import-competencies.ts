// Read one competency sheet. Write a new private text snapshot without changing source files.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { readPlan } from "../src/cli.ts";
import { parseFile, type Diag, type Stmt } from "../src/parse.ts";
import { sanitizeId } from "./import-legacy.ts";

const normalizeName = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const quoted = (s: string) => {
  if (/["\r\n]/.test(s)) throw new Error("A source label contains quotes or line breaks. Review it before import.");
  return `"${s}"`;
};
const cellValue = (cell: ExcelJS.Cell): string | number | null => {
  const v = cell.value;
  if (v === null || typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "object" && "richText" in v) return v.richText.map((part) => part.text).join("");
  if (typeof v === "object" && "result" in v && (typeof v.result === "string" || typeof v.result === "number")) return v.result;
  throw new Error(`Unsupported or uncached cell value at ${cell.address}.`);
};
const label = (cell: ExcelJS.Cell) => String(cellValue(cell) ?? "").replace(/\s+/g, " ").trim();

export async function convertCompetencies(matrix: string, plan: string, aliases: Record<string, string> = {}) {
  const diags: Diag[] = [];
  const stmts = readPlan(plan).flatMap((f) => parseFile(f.text, f.path, diags));
  if (diags.some((d) => d.level === "error" && d.code !== "E004")) throw new Error("Plan has syntax errors. Run lint before import.");
  const persons = stmts.filter((s): s is Extract<Stmt, { kind: "person" }> => s.kind === "person");
  if (new Set(persons.map((p) => p.id)).size !== persons.length) throw new Error("Plan has duplicate person IDs.");
  for (const [id, name] of Object.entries(aliases))
    if (!persons.some((p) => p.id === id) || typeof name !== "string" || !name.trim()) throw new Error(`Invalid person alias: ${id}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(matrix);
  const ws = wb.getWorksheet("Fähigkeitsmatrix_new");
  if (!ws) throw new Error("Missing sheet: Fähigkeitsmatrix_new");
  const headers: number[] = [];
  ws.eachRow((row, r) => {
    if (label(row.getCell(2)) === "Name" && label(row.getCell(3)) === "active") headers.push(r);
  });
  if (headers.length !== 1) throw new Error("Expected one Name/active header row.");
  const header = headers[0], skills: { column: number; id: string; title: string }[] = [];
  const skillIds = new Set<string>();
  ws.getRow(header).eachCell((cell, column) => {
    if (column < 4) return;
    const title = label(cell);
    if (!title) return;
    const id = sanitizeId(title);
    if (!id || skillIds.has(id)) throw new Error(`Empty or colliding competency ID at column ${column}.`);
    skillIds.add(id); skills.push({ column, id, title });
  });
  if (!skills.length) throw new Error("No competency columns found.");
  const level = (row: number, column: number): number | undefined => {
    const value = cellValue(ws.getCell(row, column));
    if (value === null || value === "") return undefined;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 4)
      throw new Error(`Expected a competency level from 0 to 4 at ${ws.getCell(row, column).address}.`);
    return value;
  };
  const levels = (row: number) => skills.flatMap((s) => {
    const value = level(row, s.column);
    return value === undefined ? [] : [`${s.id}:${value}`];
  }).join(" ");
  const lines = ["# Private competency snapshot. Review identity matches before use."];
  if (diags.length) lines.push(`# Existing plan has ${diags.length} date errors. Import does not repair them.`);
  const declaredRoles = new Set(stmts.flatMap((s) => s.kind === "role" ? [s.id] : []));
  const referencedRoles = new Set(stmts.flatMap((s) => s.kind === "person" ? s.roles : s.kind === "project" || s.kind === "task"
    ? [...(s.attrs.other.role?.split(",") ?? []), ...(s.kind === "task" ? s.roles.map((r) => r.role) : [])] : []));
  lines.push("# Planning roles copied from existing references. Review their spelling.",
    ...[...referencedRoles].filter((id) => !declaredRoles.has(id)).sort().map((id) => `role ${id}`));
  lines.push(...skills.map((s) => `competency ${s.id} ${quoted(s.title)}`));
  const profileIds = new Set<string>();
  for (let row = 1; row < header; row++) {
    if (label(ws.getCell(row, 1)) !== "ROLE") continue;
    const title = label(ws.getCell(row, 2)), id = sanitizeId(title);
    if (!id || profileIds.has(id)) throw new Error(`Empty or colliding profile ID at row ${row}.`);
    profileIds.add(id); lines.push(`profile ${id} ${quoted(title)} ${levels(row)}`.trimEnd());
  }
  if (!profileIds.size) throw new Error("No ROLE requirement rows found.");
  const matrixPeople: { row: number; name: string; active: boolean; levels: string }[] = [];
  for (let row = header + 1; row <= ws.rowCount; row++) {
    const name = label(ws.getCell(row, 2));
    if (!name) continue;
    const active = cellValue(ws.getCell(row, 3));
    if (active !== 0 && active !== 1) throw new Error(`Expected active flag 0 or 1 at row ${row}.`);
    matrixPeople.push({ row, name, active: active === 1, levels: levels(row) });
  }
  const unmatched: string[] = [], usedRows = new Set<number>();
  let matched = 0;
  for (const p of persons) {
    const alias = Object.hasOwn(aliases, p.id) ? aliases[p.id].replace(/\s+/g, " ").trim() : undefined;
    const candidates = matrixPeople.filter((m) => alias !== undefined ? m.name === alias
      : !!p.name && !!normalizeName(p.name) && normalizeName(m.name) === normalizeName(p.name));
    if (candidates.length !== 1) {
      if (alias !== undefined) throw new Error(`Alias for @${p.id} must match one exact matrix name.`);
      unmatched.push(p.id); continue;
    }
    const m = candidates[0];
    if (usedRows.has(m.row)) throw new Error(`One matrix row matches multiple plan people, including @${p.id}.`);
    usedRows.add(m.row); matched++;
    lines.push(`assessment @${p.id} active:${m.active} ${m.levels}`.trimEnd());
  }
  lines.push(...unmatched.map((id) => `# No unique matrix match for @${id}. Supply an explicit alias.`));
  return { text: lines.join("\n") + "\n", matched, unmatched, profiles: profileIds.size, competencies: skills.length, dateErrors: diags.length };
}

async function main(argv: string[]): Promise<number> {
  const [matrix, plan, ...rest] = argv;
  const flag = (name: string) => { const i = rest.indexOf(name); return i < 0 ? undefined : rest[i + 1]; };
  const out = flag("-o"), aliasPath = flag("--aliases");
  if (!matrix || !plan || !out) {
    console.error("usage: node tools/import-competencies.ts matrix.xlsx plan-dir -o new.pbt [--aliases aliases.json]"); return 2;
  }
  try {
    const aliases = aliasPath ? JSON.parse(readFileSync(aliasPath, "utf8")) : {};
    if (!aliases || Array.isArray(aliases) || typeof aliases !== "object") throw new Error("Aliases must be a JSON object from person ID to exact matrix name.");
    const result = await convertCompetencies(matrix, plan, aliases);
    writeFileSync(out, result.text, { flag: "wx" });
    console.log(JSON.stringify({ matched: result.matched, unmatched: result.unmatched, profiles: result.profiles, competencies: result.competencies, dateErrors: result.dateErrors }));
    return 0;
  } catch (e) { console.error((e as Error).message); return 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)))
  main(process.argv.slice(2)).then((code) => process.exitCode = code);
