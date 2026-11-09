#!/usr/bin/env node
// pbt CLI: lint | report | xlsx
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, type SourceFile } from "./compile.ts";
import { dayNum, fmt } from "./dates.ts";
import { renderReport } from "./report.ts";
import { profileRows } from "./views.ts";

export function readPlan(dir: string): SourceFile[] {
  const root = resolve(dir);
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      if (f.startsWith(".") || f === "node_modules") return [];
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : f.endsWith(".pbt") ? [p] : [];
    });
  return walk(root).sort().map((p) => ({ path: relative(root, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8") }));
}

function today(): number {
  const d = new Date();
  return dayNum(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const USAGE = `usage:
  pbt lint   <dir> [--info]           print diagnostics, exit 1 on errors
  pbt report <dir> [-o plan.html]      write the self-contained HTML report
  pbt xlsx   <dir> [-o plan.xlsx]      write the spreadsheet export
  pbt match  <dir> --profile ID        print qualification checks as JSON
  pbt match  <dir> --task ROOT.task    use the task's inherited profile
matching: --include-inactive includes people marked inactive; no bookings are changed
options: --as-of YYYY-MM-DD (date from which remaining effort is spread; default today)`;

async function main(argv: string[]): Promise<number> {
  const [cmd, dir, ...rest] = argv;
  if (!cmd || !dir || cmd === "-h" || cmd === "--help") { console.log(USAGE); return cmd ? 0 : 2; }
  const flag = (n: string) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const asOfS = flag("--as-of");
  const asOf = asOfS ? dayNum(+asOfS.slice(0, 4), +asOfS.slice(5, 7), +asOfS.slice(8, 10)) : today();
  const files = readPlan(dir);
  if (!files.length) { console.error(`no .pbt files under ${dir}`); return 2; }
  const { model, diagnostics } = compile(files, { asOf });
  const errors = diagnostics.filter((d) => d.level === "error").length;

  if (cmd === "match") {
    const profileArg = flag("--profile"), task = flag("--task");
    if (errors) { console.error("Plan has errors. Run lint before matching."); return 1; }
    if (!!profileArg === !!task) { console.error("Specify one --profile ID or --task PATH."); return 2; }
    const profile = profileArg ?? model.nodes.get(task!.replace(/^\+/, ""))?.profile;
    if (!profile || !model.profiles.has(profile)) { console.error("No known qualification profile selected."); return 2; }
    console.log(JSON.stringify(profileRows(model, profile, rest.includes("--include-inactive")), null, 2));
    return 0;
  }

  if (cmd === "lint") {
    const showInfo = rest.includes("--info");
    for (const d of diagnostics) {
      if (d.level === "info" && !showInfo) continue;
      console.log(`${d.loc ? `${d.loc.file}:${d.loc.line}` : "-"}  ${d.code} ${d.level.padEnd(7)} ${d.msg}`);
    }
    const w = diagnostics.filter((d) => d.level === "warning").length;
    console.log(`\n${files.length} files · ${errors} errors · ${w} warnings`);
    return errors ? 1 : 0;
  }
  if (cmd === "report") {
    const out = flag("-o") ?? "plan.html";
    writeFileSync(out, renderReport(model, diagnostics, { title: flag("--title"), generated: fmt(asOf) }));
    console.log(`wrote ${out} (${errors} errors)`);
    return 0;
  }
  if (cmd === "xlsx") {
    const out = flag("-o") ?? "plan.xlsx";
    const { writeXlsx } = await import("./xlsx.ts");
    await writeXlsx(model, diagnostics, out);
    console.log(`wrote ${out}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main(process.argv.slice(2)).then((c) => process.exit(c));
