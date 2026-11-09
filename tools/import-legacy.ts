// One-off importer: legacy resources.md (+ optional effort .xlsx) → plan files.
// Keeps legacy mistakes visible (typos, invalid dates, unknown projects) so the first lint shows them.
// usage: node tools/import-legacy.ts <resources.md> [effort.xlsx] -o <outdir> [--root OBC7B] [--window 2025-01..2025-12]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFile } from "../src/parse.ts";

export const sanitizeId = (s: string) => s.trim().replace(/&/g, "and").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
export const personId = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const p2 = (n: number) => String(n).padStart(2, "0");

/** Legacy end "DD.MM.YYYY": day 01 means exclusive (ends the previous day); other days are inclusive. Invalid dates are passed through. */
export function legacyEnd(d: number, m: number, y: number): string {
  if (d === 1) {
    const t = new Date(Date.UTC(y, m - 1, 0)); // previous day
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), "end");
  }
  return iso(y, m, d, "end");
}
/** Prefer month precision when the date sits on a month boundary. */
export function iso(y: number, m: number, d: number, side: "start" | "end"): string {
  const valid = m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m);
  if (valid && side === "start" && d === 1) return `${y}-${p2(m)}`;
  if (valid && side === "end" && d === dim(y, m)) return `${y}-${p2(m)}`;
  return `${y}-${p2(m)}-${p2(d)}`;
}
export function legacyRange(from: string, to: string): string {
  const [d1, m1, y1] = from.split(".").map(Number);
  const [d2, m2, y2] = to.split(".").map(Number);
  return `${iso(y1, m1, d1, "start")}..${legacyEnd(d2, m2, y2)}`;
}
const isoRange = (a: string, b: string, exclusiveFirst = true) => {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return `${iso(y1, m1, d1, "start")}..${exclusiveFirst ? legacyEnd(d2, m2, y2) : iso(y2, m2, d2, "end")}`;
};

export function convertResources(md: string): { registry: string; teams: string; notes: string[] } {
  const notes: string[] = [];
  const reg: string[] = ["# Imported from legacy resources.md — review the IMPORT notes, then delete them", "calendar CH 8h/d 164h/m", ""];
  const team: string[] = ["# Imported bookings from legacy resources.md (teams/ ⇒ confirmed)", ""];
  let mode: "" | "projects" | "resources" | "assign" | "gantt" = "";
  let who = "";
  const names = new Map<string, string>();
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Projects:/i.test(line)) { mode = "projects"; reg.push("# projects"); continue; }
    if (/^Resources:/i.test(line)) { mode = "resources"; reg.push("", "# people"); continue; }
    if (/^Assignments:/i.test(line)) { mode = "assign"; continue; }
    if (/^@startgantt/.test(line)) { mode = "gantt"; notes.push("skipped a PlantUML @startgantt block (example notation, not data)"); team.push("# IMPORT: skipped PlantUML @startgantt…@endgantt block"); continue; }
    if (mode === "gantt") { if (/^@endgantt/.test(line)) mode = "assign"; continue; }

    if (mode === "projects") {
      const m = line.match(/^(.+?)(?:\s+starts\s+(\d{4}-\d{2}-\d{2})\s+ends\s+(\d{4}-\d{2}-\d{2}))?$/);
      if (!m) continue;
      const id = sanitizeId(m[1]);
      const title = id !== m[1].trim() ? ` "${m[1].trim()}"` : "";
      reg.push(`project +${id}${title}${m[2] ? " " + isoRange(m[2], m[3]) : ""}`);
    } else if (mode === "resources") {
      const m = line.match(/^(.+?)\s+(\d+)%$/);
      if (!m) { reg.push(`# IMPORT: could not convert: ${line}`); continue; }
      const id = personId(m[1]);
      names.set(m[1].trim(), id);
      reg.push(`person @${id} "${m[1].trim()}" cap:${m[2]}% loc:CH`);
    } else if (mode === "assign") {
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^(sect?i?on)\s+(.+)$/i))) {
        who = names.get(m[2].trim()) ?? personId(m[2]);
        team.push("", `# ${m[2].trim()}${m[1].toLowerCase() !== "section" ? `   # IMPORT: legacy header was misspelled "${m[1]}"` : ""}`);
      } else if ((m = line.match(/^-\s*(.+?)\s+(\d+)%\s+from\s+(\d{2}\.\d{2}\.\d{4})\s+to\s+(\d{2}\.\d{2}\.\d{4})$/))) {
        const id = sanitizeId(m[1]);
        const note = id !== m[1] ? `   # IMPORT: legacy name "${m[1]}"` : "";
        team.push(`@${who} +${id} ${m[2]}% ${legacyRange(m[3], m[4])}${note}`);
      } else if ((m = line.match(/^(\S+?)_(\d+)%\s*:\s*\w+\s*,\s*(\d{4}-\d{2}-\d{2})\s*,\s*(\d{4}-\d{2}-\d{2})$/))) {
        team.push(`@${who} +${sanitizeId(m[1])} ${m[2]}% ${isoRange(m[3], m[4], false)}   # IMPORT: from Mermaid-style line "${line}"`);
      } else {
        team.push(`# IMPORT: could not convert: ${line}`);
        notes.push(`could not convert assignment line: ${line}`);
      }
    }
  }
  return { registry: reg.join("\n") + "\n", teams: team.join("\n") + "\n", notes };
}

const cellVal = (v: ExcelJS.CellValue): string | number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "formula" in (v as object)) {
    const f = v as ExcelJS.CellFormulaValue;
    if (typeof f.result === "number") return f.result;
    const expr = f.formula.replace(/^\+/, "");
    if (/^[\d+\-*/(). ]+$/.test(expr)) return Function(`"use strict";return (${expr})`)() as number; // arithmetic only
    return null;
  }
  if (typeof v === "object" && "richText" in (v as object)) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  return v as string | number;
};

export function splitRoles(who: string): { roles: string[]; dropped: string[] } {
  const parts: string[] = []; let depth = 0, cur = "";
  for (const c of who.replace(/\n/g, ",")) {
    if (c === "(") depth++; if (c === ")") depth--;
    if (c === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const roles: string[] = [], dropped: string[] = [];
  for (let p of parts.map((x) => x.trim()).filter(Boolean)) {
    const m = p.match(/^([A-Za-z]+)\s*\(([^)]*)\)$/);
    if (m && !/\s/.test(m[2].trim()) || (m && m[2].split(",").every((x) => /^[A-Za-z]+$/.test(x.trim())))) {
      for (const sub of m![2].split(",")) roles.push(`${sanitizeId(m![1]).toUpperCase()}.${sanitizeId(sub).toUpperCase()}`);
      continue;
    }
    const q = p.match(/^([A-Za-z]+)\s*\((.*)\)$/);
    if (q) { dropped.push(`${q[1]}(${q[2]})`); p = q[1]; }
    roles.push(sanitizeId(p).toUpperCase());
  }
  return { roles, dropped };
}

const slug = (s: string, used: Set<string>) => {
  let b = s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => !["the", "and", "of", "for", "due", "to", "a"].includes(w)).reduce((acc: string[], w) => (acc.join("_").length + w.length < 26 && acc.length < 4 ? [...acc, w] : acc), []).join("_") || "item";
  if (/^\d/.test(b)) b = "x" + b;
  let s2 = b, i = 2;
  while (used.has(s2)) s2 = `${b}_${i++}`;
  used.add(s2);
  return s2;
};

export async function convertEffort(xlsxPath: string, root: string, window?: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const out: string[] = [
    `# Imported from ${xlsxPath.split(/[\\/]/).pop()} — effort per activity and role`,
    `# The root is declared in registry.pbt.${window ? "" : " IMPORT: the sheet has no dates; add a window there or on the sections."}`, "",
  ];
  const usedSec = new Set<string>(); let usedTask = new Set<string>();
  let section = "";
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = [1, 2, 3, 4, 5, 6].map((i) => cellVal(row.getCell(i).value));
    const [dept, loc, act, who, , hours] = v;
    if (dept && !loc && !act && !who) {
      section = slug(String(dept), usedSec); usedTask = new Set();
      out.push("", `+${root}.${section} "${String(dept).trim()}"`);
      return;
    }
    if (!act) return;
    const path = section ? `${root}.${section}` : root;
    const id = slug(String(act), usedTask);
    const title = String(act).replace(/\s*\n\s*/g, " / ").replace(/"/g, "'").trim();
    const { roles, dropped } = who ? splitRoles(String(who)) : { roles: [], dropped: [] };
    const tags = [dept, loc].filter(Boolean).map((t) => "#" + sanitizeId(String(t)));
    const eff = typeof hours === "number" && hours > 0 ? ` ~${Math.round(hours * 10) / 10}h` : "";
    const notes = [!eff ? "IMPORT: no hours in sheet" : "", dropped.length ? `IMPORT: role details dropped: ${dropped.join(", ")}` : ""].filter(Boolean);
    out.push(`+${path}.${id} "${title}"${eff} ${roles.map((r) => "?" + r).join(" ")} ${tags.join(" ")}${notes.length ? "   # " + notes.join("; ") : ""}`.replace(/\s+$/, "").replace(/ {2,}(?!#)/g, " "));
  });
  return out.join("\n") + "\n";
}

async function main(argv: string[]) {
  const pos = argv.filter((a, i) => !a.startsWith("-") && !["-o", "--root", "--window"].includes(argv[i - 1]));
  const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const [mdPath, xlsxPath] = pos;
  const outDir = flag("-o") ?? "plan";
  if (!mdPath) { console.error("usage: node tools/import-legacy.ts <resources.md> [effort.xlsx] -o <outdir> [--root OBC7B] [--window 2025-01..2025-12]"); return 2; }
  mkdirSync(join(outDir, "teams"), { recursive: true });
  const r = convertResources(readFileSync(mdPath, "utf8"));
  let registry = r.registry;
  if (xlsxPath) {
    const root = flag("--root") ?? "OBC7B";
    const window = flag("--window");
    registry += `\n# effort plan root (from ${xlsxPath.split(/[\\/]/).pop()})\nproject +${root} "Effort plan ${root}"${window ? " " + window : ""}\n`;
    mkdirSync(join(outDir, "projects"), { recursive: true });
    const text = await convertEffort(xlsxPath, root, window);
    const roles = new Set(parseFile(text, `projects/${root}.pbt`, []).flatMap((s) => s.kind === "task" ? s.roles.map((r) => r.role) : []));
    registry += `\n# roles from the effort plan\n${[...roles].sort().map((role) => `role ${role}`).join("\n")}\n`;
    writeFileSync(join(outDir, "projects", `${root}.pbt`), text);
  }
  writeFileSync(join(outDir, "registry.pbt"), registry);
  writeFileSync(join(outDir, "teams", "legacy.pbt"), r.teams);
  for (const n of r.notes) console.log("note:", n);
  console.log(`wrote ${outDir}/registry.pbt, ${outDir}/teams/legacy.pbt${xlsxPath ? `, ${outDir}/projects/*.pbt` : ""}`);
  return 0;
}

if (process.argv[1] && /import-legacy\.ts$/.test(process.argv[1])) main(process.argv.slice(2)).then((c) => process.exit(c));
