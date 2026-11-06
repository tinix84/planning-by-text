import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, type SourceFile } from "../src/compile.ts";
import { dayNum } from "../src/dates.ts";
import { roleRows, treeRows } from "../src/views.ts";

const REG = `
calendar CH 8h/d 164h/m
calendar DE 8h/d 160h/m
person @alice "Alice" cap:100% role:POW loc:CH
person @bob "Bob" cap:50% role:DSP loc:CH
person @dora "Dora" cap:100% role:POW loc:DE
project +ALPHA "Alpha" 2024-01..2024-06
`;
const plan = (files: Record<string, string>): SourceFile[] =>
  Object.entries({ "registry.pbt": REG, ...files }).map(([path, text]) => ({ path, text }));
const run = (files: Record<string, string>, asOf?: number) => compile(plan(files), { asOf });
const codes = (files: Record<string, string>) => run(files).diagnostics.map((d) => d.code);
const hours = (m: ReturnType<typeof run>["model"], p: string, month: number) =>
  Math.round(m.load.get(p)!.get(2024 * 12 + month - 1)?.hours ?? 0);

test("a clean plan has no diagnostics", () => {
  const { diagnostics } = run({ "teams/t.pbt": "@alice +ALPHA 100% 2024-01..2024-02" });
  assert.deepEqual(diagnostics, []);
});

test("syntax errors carry file and line", () => {
  const { diagnostics } = run({ "teams/t.pbt": "\n\n@alice +ALPHA 2024-01" });
  assert.equal(diagnostics[0].code, "E001");
  assert.deepEqual(diagnostics[0].loc, { file: "teams/t.pbt", line: 3 });
});

test("unknown root suggests the closest declared root", () => {
  const { diagnostics } = run({ "teams/t.pbt": "@alice +ALPA 50% 2024-01" });
  assert.equal(diagnostics[0].code, "E002");
  assert.match(diagnostics[0].msg, /did you mean \+ALPHA/);
});

test("unknown person, invalid date, duplicate declaration", () => {
  assert.deepEqual(codes({ "teams/t.pbt": "@zed +ALPHA 50% 2024-01" }), ["E003"]);
  assert.deepEqual(codes({ "teams/t.pbt": "@alice +ALPHA 50% 2024-01..2024-04-31" }), ["E004"]);
  assert.deepEqual(codes({ "x.pbt": 'person @alice "Again"' }), ["E005"]);
});

test("overload is reported once per person with the peak", () => {
  const { diagnostics } = run({ "teams/t.pbt": "@alice +ALPHA 100% 2024-01..2024-03\n@alice +ALPHA.x 0% 2024-01\n+ALPHA.side ~1h\n@bob +ALPHA 60% 2024-02" });
  const w = diagnostics.filter((d) => d.code === "W101");
  assert.equal(w.length, 1);
  assert.match(w[0].msg, /@bob .*2024-02.*120%/);
});

test("booking on zero capacity", () => {
  assert.ok(codes({ "registry2.pbt": 'person @zero "Z" cap:0%', "teams/t.pbt": "@zero +ALPHA 10% 2024-01" }).includes("W102"));
});

test("calendar hours per month follow the person's location", () => {
  const { model } = run({ "teams/t.pbt": "@alice +ALPHA 50% 2024-01\n@dora +ALPHA 50% 2024-01" });
  assert.equal(hours(model, "alice", 1), 82);
  assert.equal(hours(model, "dora", 1), 80);
});

test("a partial month counts only the working days covered", () => {
  // January 2024 has 23 working days; 1–15 Jan has 11
  const { model } = run({ "teams/t.pbt": "@alice +ALPHA 100% 2024-01-01..2024-01-15" });
  assert.equal(hours(model, "alice", 1), Math.round(164 * 11 / 23));
});

test("capacity changes apply only inside their window", () => {
  const { model } = run({ "teams/t.pbt": "@alice cap:50% 2024-02\n@alice +ALPHA 60% 2024-01..2024-02" });
  assert.equal(Math.round(model.load.get("alice")!.get(2024 * 12)!.capHours), 164);
  assert.equal(Math.round(model.load.get("alice")!.get(2024 * 12 + 1)!.capHours), 82);
});

test("pins consume the pool and never add to it", () => {
  const { model, diagnostics } = run({
    "projects/ALPHA.pbt": "+ALPHA.pfc ~10h ?POW",
    "teams/t.pbt": "@alice +ALPHA 50% 2024-01..2024-02\n@alice +ALPHA.pfc 30% 2024-01\n@alice +ALPHA.pfc 80% 2024-02",
  });
  assert.equal(hours(model, "alice", 1), 82);      // max(82, 49)
  assert.equal(hours(model, "alice", 2), 131);     // max(82, 131) and W105
  assert.deepEqual(diagnostics.filter((d) => d.code === "W105").length, 1);
});

test("booking status follows the folder; status: overrides", () => {
  const { model, diagnostics } = run({
    "projects/ALPHA.pbt": "@alice +ALPHA 10% 2024-01\n@bob +ALPHA 10% 2024-01 status:confirmed",
    "teams/t.pbt": "@dora +ALPHA 10% 2024-01",
    "misc.pbt": "@dora +ALPHA 10% 2024-02",
  });
  const st = Object.fromEntries(model.bookings.map((b) => [`${b.person}:${b.at.file}`, b.status]));
  assert.equal(st["alice:projects/ALPHA.pbt"], "requested");
  assert.equal(st["bob:projects/ALPHA.pbt"], "confirmed");
  assert.equal(st["dora:teams/t.pbt"], "confirmed");
  assert.equal(st["dora:misc.pbt"], "unspecified");
  assert.equal(diagnostics.filter((d) => d.code === "I201").length, 1);
});

test("children inherit the window and effort rolls up", () => {
  const { model } = run({ "projects/ALPHA.pbt": "+ALPHA.a.x ~100h ?POW\n+ALPHA.a.y ~2d ?POW\n+ALPHA.b ~1pm ?DSP" });
  const t = Object.fromEntries(treeRows(model).map((r) => [r.path, r]));
  assert.equal(t["ALPHA"].effort, 100 + 16 + 164);
  assert.equal(t["ALPHA.a"].effort, 116);
  assert.equal(t["ALPHA.a.x"].window, "2024-01-01..2024-06-30");
});

test("a parent budget smaller than its children is a warning", () => {
  assert.ok(codes({ "projects/ALPHA.pbt": "+ALPHA.a ~10h\n+ALPHA.a.x ~20h ?POW" }).includes("W109"));
});

test("child window outside the parent", () => {
  assert.ok(codes({ "projects/ALPHA.pbt": "+ALPHA.a ~10h ?POW 2024-05..2024-08" }).includes("W106"));
});

test("a path used but never declared is flagged with a suggestion", () => {
  const { diagnostics } = run({ "projects/ALPHA.pbt": "+ALPHA.design ~10h ?POW", "teams/t.pbt": "@alice +ALPHA.desgin 10% 2024-01" });
  const w = diagnostics.find((d) => d.code === "W103")!;
  assert.match(w.msg, /did you mean \.design/);
});

test("after: narrows the start; relative references resolve", () => {
  const { model } = run({ "projects/ALPHA.pbt": "+ALPHA.p.design ~10h ?POW 2024-01..2024-02\n+ALPHA.p.test ~10h ?POW after:.design\n+ALPHA.q ~10h ?POW after:ALPHA.p.test" });
  const t = Object.fromEntries(treeRows(model).map((r) => [r.path, r.window]));
  assert.equal(t["ALPHA.p.test"], "2024-03-01..2024-06-30");
  assert.equal(t["ALPHA.q"], "");  // empty window → no demand
});

test("unresolved after: and dependency cycles", () => {
  assert.ok(codes({ "projects/ALPHA.pbt": "+ALPHA.a ~1h after:.nope" }).includes("E006"));
  assert.ok(codes({ "projects/ALPHA.pbt": "+ALPHA.a ~1h after:.b\n+ALPHA.b ~1h after:.a" }).includes("E007"));
});

test("demand is spread uniformly by working days and split by role share", () => {
  const { model } = run({ "projects/ALPHA.pbt": "+ALPHA.t ~440h ?POW:75% ?DSP 2024-01..2024-02" });
  const rows = Object.fromEntries(roleRows(model).map((r) => [r.role, r]));
  // Jan 23 wd, Feb 21 wd → 230 h / 210 h
  assert.equal(Math.round(rows.POW.demand[0]), Math.round(330 * 23 / 44));
  assert.equal(Math.round(rows.DSP.demand[1]), Math.round(110 * 21 / 44));
});

test("role shortfall is reported per root and role", () => {
  const { diagnostics } = run({ "projects/ALPHA.pbt": "+ALPHA.t ~300h ?POW 2024-01", "teams/t.pbt": "@alice +ALPHA 100% 2024-01" });
  const w = diagnostics.find((d) => d.code === "W104")!;
  assert.match(w.msg, /\+ALPHA \?POW.*2024-01.*short 136 h/);
});

test("remaining effort is spread from the as-of date", () => {
  const { model } = run({ "projects/ALPHA.pbt": "+ALPHA.t ~1000h left:100h ?POW" }, dayNum(2024, 6, 1));
  const pow = roleRows(model).find((r) => r.role === "POW")!;
  assert.equal(Math.round(pow.demand.reduce((a, b) => a + b, 0)), 100);
  assert.equal(pow.demand.filter((v) => v > 0).length, 1);
});

test("effort without any window is reported once per root", () => {
  const { diagnostics } = run({ "registry2.pbt": "project +NODATE", "projects/N.pbt": "+NODATE.a ~10h\n+NODATE.b ~5h" });
  const w = diagnostics.filter((d) => d.code === "W108");
  assert.equal(w.length, 1);
  assert.match(w[0].msg, /2 task\(s\) with 15 h/);
});

test("bookings on an unknown root still count in the person's load", () => {
  const { model, diagnostics } = run({ "teams/t.pbt": "@alice +GHOST 50% 2024-01" });
  assert.equal(diagnostics[0].code, "E002");
  assert.equal(hours(model, "alice", 1), 82);
});
