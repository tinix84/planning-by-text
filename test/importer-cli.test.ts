import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertResources, legacyRange, splitRoles } from "../tools/import-legacy.ts";
import { compile } from "../src/compile.ts";

test("legacy 'to 01.MM.YYYY' is exclusive, other ends inclusive", () => {
  assert.equal(legacyRange("01.01.2024", "01.03.2024"), "2024-01..2024-02");
  assert.equal(legacyRange("01.01.2024", "31.12.2024"), "2024-01..2024-12");
  assert.equal(legacyRange("01.04.2024", "01.01.2025"), "2024-04..2024-12");
  assert.equal(legacyRange("15.01.2024", "20.02.2024"), "2024-01-15..2024-02-20");
  assert.equal(legacyRange("01.01.2024", "31.04.2024"), "2024-01..2024-04-31"); // kept, so lint reports it
});

test("Who column becomes role demands", () => {
  assert.deepEqual(splitRoles("POW, DSP,PCB").roles, ["POW", "DSP", "PCB"]);
  assert.deepEqual(splitRoles("CONN(SYS, SW), TPM").roles, ["CONN.SYS", "CONN.SW", "TPM"]);
  const r = splitRoles("POW (MCU FuSa rel+SENS)");
  assert.deepEqual(r.roles, ["POW"]);
  assert.equal(r.dropped.length, 1);
});

const LEGACY = `Projects:
\tALPHA
\tBeta Project starts 2024-01-01 ends 2024-03-01
\tALPHA
Resources:
    Ann Example 100%
    Joël Sample 0%
Assignments:
    section Ann Example
        - ALPHA 100% from 01.01.2024 to 01.03.2024
        - ALPHA 50% from 01.01.2024 to 31.04.2024
        - ALPHA 50% from 01.02.2024 to 01.04.2024
    secton Joël Sample
        - Beta Project 10% from 01.01.2024 to 01.02.2024
        - ALPA 10% from 01.01.2024 to 01.02.2024
        - St
`;

test("importer keeps legacy errors visible for the first lint", () => {
  const r = convertResources(LEGACY);
  assert.match(r.registry, /project \+Beta_Project "Beta Project" 2024-01\.\.2024-02/);
  assert.match(r.registry, /person @joel_sample "Joël Sample" cap:0%/);
  assert.match(r.teams, /misspelled "secton"/);
  assert.match(r.teams, /# IMPORT: could not convert: - St/);
  const { diagnostics } = compile([{ path: "registry.pbt", text: r.registry }, { path: "teams/legacy.pbt", text: r.teams }]);
  const codes = diagnostics.map((d) => d.code).sort();
  assert.ok(!codes.includes("E001"), "import output must parse");
  for (const c of ["E002", "E004", "E005", "W101", "W102"]) assert.ok(codes.includes(c), `expected ${c} in ${codes}`);
});

test("CLI: lint exit code, report and xlsx files", () => {
  const fx = join(import.meta.dirname, "fixtures", "basic");
  const lint = spawnSync(process.execPath, ["src/cli.ts", "lint", fx], { encoding: "utf8" });
  assert.equal(lint.status, 1);
  assert.match(lint.stdout, /E002 error +unknown root \+GAMA/);
  const out = mkdtempSync(join(tmpdir(), "pbt-"));
  execFileSync(process.execPath, ["src/cli.ts", "report", fx, "-o", join(out, "p.html"), "--as-of", "2024-01-01"]);
  const html = readFileSync(join(out, "p.html"), "utf8");
  for (const id of ["@alice", "@bob", "@carol"]) assert.ok(html.includes(id));
  assert.ok(!/<script[^>]+src=|<link[^>]+href="http/.test(html), "report must be self-contained");
  execFileSync(process.execPath, ["src/cli.ts", "xlsx", fx, "-o", join(out, "p.xlsx")]);
  assert.ok(existsSync(join(out, "p.xlsx")));
});
