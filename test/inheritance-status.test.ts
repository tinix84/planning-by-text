import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, type SourceFile } from "../src/compile.ts";
import { loadRows, monthHeaders, roleRows, treeRows } from "../src/views.ts";
import { renderReport } from "../src/report.ts";

const registry = `role HW
role SYS
role TEST
role DSP
calendar CH 8h/d 164h/m
calendar DE 6h/d 150h/m
person @alice "Alice Example" role:HW loc:CH
project +ALPHA "Alpha Example" 2024-01..2024-03 #site`;
const run = (files: Record<string, string>) => compile(Object.entries({ "registry.pbt": registry, ...files })
  .map(([path, text]) => ({ path, text })));
type Result = ReturnType<typeof compile>;
const cell = (r: Result, month = "2024-01") => loadRows(r.model)[0].cells[monthHeaders(r.model).indexOf(month)]!;
const task = (r: Result, path: string) => treeRows(r.model).find((x) => x.path === path)!;

test("tags flow through implicit parents and combine without duplicates", () => {
  const r = run({ "projects/a.pbt": "+ALPHA.group #dept\n+ALPHA.group.implicit.task ~100h ?HW #site #test" });
  assert.equal(task(r, "ALPHA.group.implicit.task").tags, "site dept test");
  assert.equal(task(r, "ALPHA.group.implicit").tags, "site dept");
});

test("default roles inherit through implicit nodes and explicit roles replace them", () => {
  const r = run({
    "registry.pbt": registry.replace("#site", "#site role:HW,SYS"),
    "projects/a.pbt": "+ALPHA.implicit.task ~100h\n+ALPHA.group ?TEST\n+ALPHA.group.child ~100h\n+ALPHA.group.override ~40h ?DSP",
  });
  const totals = Object.fromEntries(roleRows(r.model).map((x) => [x.role, Math.round(x.demand.reduce((a, b) => a + b, 0))]));
  assert.deepEqual(totals, { DSP: 40, HW: 50, SYS: 50, TEST: 100 });
  assert.equal(task(r, "ALPHA.implicit.task").roles, "HW SYS");
  assert.equal(task(r, "ALPHA.group.override").roles, "DSP");
});

test("effort and remaining effort use the inherited calendar while supply uses the person's calendar", () => {
  const r = run({
    "registry.pbt": registry.replace("#site", "#site loc:DE role:HW"),
    "projects/a.pbt": "+ALPHA.implicit.task ~2pm left:1pm\n+ALPHA.days ~2d\n+ALPHA.override loc:CH\n+ALPHA.override.task ~1pm left:2d",
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
  });
  assert.equal(task(r, "ALPHA.implicit.task").effort, 300);
  assert.equal(task(r, "ALPHA.implicit.task").remaining, 150);
  assert.equal(task(r, "ALPHA.days").effort, 12);
  assert.equal(task(r, "ALPHA.override.task").effort, 164);
  assert.equal(task(r, "ALPHA.override.task").remaining, 16);
  assert.equal(cell(r).hours, 164);
});

test("project budget syntax uses the root calendar and does not add to its children", () => {
  const r = run({
    "registry.pbt": registry.replace("#site", "#site loc:DE role:HW ~1pm"),
    "projects/a.pbt": "+ALPHA.task ~160h",
  });
  assert.ok(!r.diagnostics.some((d) => d.level === "error"));
  assert.equal(task(r, "ALPHA").effort, 160);
  assert.equal(r.diagnostics.filter((d) => d.code === "W109").length, 1);
  assert.match(r.diagnostics.find((d) => d.code === "W109")!.msg, /budget ~150h/);
});

test("HTML tree rows retain full paths so project filters include descendants", () => {
  const r = run({ "projects/a.pbt": '+ALPHA.group.task "A & B" ~100h ?HW' });
  const html = renderReport(r.model, r.diagnostics);
  const row = html.match(/<tr class="f[^>]*>[^]*?A &amp; B[^]*?<\/tr>/)?.[0];
  assert.ok(row?.includes(">ALPHA.group.task</td>"));
  assert.ok(html.includes(">ALPHA.group</td>"));
});

test("requested pins keep their status while consuming a confirmed pool", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
    "projects/a.pbt": "+ALPHA.task\n@alice +ALPHA.task 25% 2024-01",
  });
  assert.equal(cell(r).hours, 100);
  assert.equal(cell(r).confirmed, 75);
  assert.equal(cell(r).requested, 25);
  assert.ok(cell(r).parts.some((x) => x.path === "ALPHA.task" && x.hours === 25 && x.status === "requested"));
  assert.equal(roleRows(r.model)[0].supply[0], 100);
});

test("an exact confirmation replaces its request after date precision is resolved", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "projects/a.pbt": "@alice +ALPHA 100% 2024-01",
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01-01..2024-01-31",
  });
  assert.equal(cell(r).hours, 100);
  assert.equal(cell(r).confirmed, 100);
  assert.equal(cell(r).requested, 0);
  assert.equal(r.model.bookings.length, 1);
  assert.equal(roleRows(r.model)[0].supply[0], 100);
  assert.ok(!r.diagnostics.some((d) => d.code === "W101" || d.code === "I201"));
  assert.ok(r.diagnostics.some((d) => d.code === "I202" && d.loc?.file === "projects/a.pbt"));
});

test("unknown explicit booking statuses fail lint instead of becoming confirmed", () => {
  const r = run({ "teams/t.pbt": "@alice +ALPHA 50% 2024-01 status:confimred" });
  assert.ok(r.diagnostics.some((d) => d.code === "E001" && d.loc?.line === 1));
  assert.equal(r.model.bookings.length, 0);
});

test("heatmap tooltips show confirmed, requested, and unspecified hours separately", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
    "projects/a.pbt": "+ALPHA.task\n@alice +ALPHA.task 25% 2024-01",
  });
  const html = renderReport(r.model, r.diagnostics);
  assert.ok(html.includes("75 h confirmed"));
  assert.ok(html.includes("25 h requested"));
  assert.ok(html.includes("0 h unspecified"));
  assert.ok(html.includes("+ALPHA.task: 25 h (requested)"));
  assert.ok(html.includes("Demand vs forecast supply"));
});

test("a standalone project budget converts remaining effort with its selected calendar", () => {
  const r = run({ "registry.pbt": registry.replace("#site", "#site loc:DE role:HW ~2pm left:1pm") });
  assert.equal(task(r, "ALPHA").effort, 300);
  assert.equal(task(r, "ALPHA").remaining, 150);
});

test("calendar conversion rejects invalid or non-positive hour factors", async (t) => {
  for (const text of ["calendar BAD -6h/d 150h/m", "calendar BAD 6h/d 0h/m", "calendar BAD 6h/d garbageh/m", "calendar BAD 0h/d 150h/m"]) {
    await t.test(text, () => {
      const r = run({ "bad.pbt": text });
      assert.ok(r.diagnostics.some((d) => d.code === "E001" && d.loc?.file === "bad.pbt"));
    });
  }
});

test("inherited role weights and explicit calendar overrides preserve demand", () => {
  const r = run({
    "registry.pbt": registry.replace("#site", "#site loc:DE"),
    "projects/a.pbt": "+ALPHA.group ?HW:60% ?SYS:40%\n+ALPHA.group.implicit.task ~1pm\n+ALPHA.group.other ~1pm loc:CH ?DSP",
  });
  const totals = Object.fromEntries(roleRows(r.model).map((x) => [x.role, Math.round(x.demand.reduce((a, b) => a + b, 0))]));
  assert.deepEqual(totals, { DSP: 164, HW: 90, SYS: 60 });
});

test("unknown node calendars identify the declaration that selects them", () => {
  const r = run({ "projects/a.pbt": "+ALPHA.group loc:MISSING\n+ALPHA.group.task ~1pm ?HW" });
  const errors = r.diagnostics.filter((d) => d.code === "E003");
  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0].loc, { file: "projects/a.pbt", line: 1 });
});

test("calendar inheritance and exact confirmation matching are independent of file order", () => {
  const files: SourceFile[] = [
    { path: "registry.pbt", text: registry.replace("#site", "#site loc:DE role:HW") },
    { path: "projects/a.pbt", text: "+ALPHA.task ~1pm\n@alice +ALPHA.task 25% 2024-01" },
    { path: "teams/t.pbt", text: "@alice +ALPHA.task 25% 2024-01" },
  ];
  const a = compile(files), b = compile([...files].reverse());
  assert.deepEqual(treeRows(a.model), treeRows(b.model));
  assert.deepEqual(loadRows(a.model), loadRows(b.model));
  assert.deepEqual(roleRows(a.model), roleRows(b.model));
  assert.deepEqual(a.diagnostics, b.diagnostics);
});

test("confirmed pins retain their hours inside a requested pool", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "projects/a.pbt": "+ALPHA.task\n@alice +ALPHA 100% 2024-01",
    "teams/t.pbt": "@alice +ALPHA.task 25% 2024-01",
  });
  assert.equal(cell(r).confirmed, 25);
  assert.equal(cell(r).requested, 75);
  assert.equal(cell(r).hours, 100);
  assert.equal(roleRows(r.model)[0].supply[0], 100);
});

test("nested status partitions preserve the residual at every level", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "projects/a.pbt": "+ALPHA.group\n+ALPHA.group.task\n@alice +ALPHA.group 60% 2024-01",
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01\n@alice +ALPHA.group.task 25% 2024-01",
  });
  assert.equal(cell(r).confirmed, 65);
  assert.equal(cell(r).requested, 35);
  assert.equal(cell(r).hours, 100);
});

test("unspecified hours remain distinct and still count as forecast supply", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "misc.pbt": "@alice +ALPHA 100% 2024-01",
    "teams/t.pbt": "+ALPHA.task\n@alice +ALPHA.task 25% 2024-01",
  });
  assert.equal(cell(r).confirmed, 25);
  assert.equal(cell(r).unspecified, 75);
  assert.equal(cell(r).requested, 0);
  assert.equal(roleRows(r.model)[0].supply[0], 100);
  assert.ok(renderReport(r.model, r.diagnostics).includes("75 h unspecified"));
});

test("an overflowing requested pin does not inherit its parent's confirmation", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
    "projects/a.pbt": "+ALPHA.task\n@alice +ALPHA.task 120% 2024-01",
  });
  assert.equal(cell(r).hours, 120);
  assert.equal(cell(r).confirmed, 0);
  assert.equal(cell(r).requested, 120);
  assert.ok(r.diagnostics.some((d) => d.code === "W105"));
});

test("matching is exact and does not approve a different percentage or window", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "projects/a.pbt": "@alice +ALPHA 50% 2024-01\n@alice +ALPHA 100% 2024-02",
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
  });
  assert.equal(cell(r).hours, 150);
  assert.equal(cell(r).requested, 50);
  assert.equal(cell(r, "2024-02").requested, 100);
  assert.ok(!r.diagnostics.some((d) => d.code === "I202"));
});

test("confirmations replace requests one for one without hiding duplicate demand", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "projects/a.pbt": "@alice +ALPHA 100% 2024-01\n@alice +ALPHA 100% 2024-01",
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01",
  });
  assert.equal(cell(r).hours, 200);
  assert.equal(cell(r).confirmed, 100);
  assert.equal(cell(r).requested, 100);
  assert.equal(r.diagnostics.filter((d) => d.code === "I202").length, 1);
  assert.equal(r.diagnostics.filter((d) => d.code === "I201").length, 1);
});

test("explicit statuses control matching instead of the source folders", () => {
  const r = run({
    "registry.pbt": registry.replace("164h/m", "100h/m"),
    "teams/t.pbt": "@alice +ALPHA 100% 2024-01 status:requested",
    "projects/a.pbt": "@alice +ALPHA 100% 2024-01 status:confirmed",
  });
  assert.equal(cell(r).hours, 100);
  assert.equal(cell(r).confirmed, 100);
  assert.equal(cell(r).requested, 0);
  assert.equal(r.model.bookings.length, 1);
});

test("duplicate root budgets fail lint instead of silently replacing an estimate", () => {
  const r = run({
    "registry.pbt": registry.replace("#site", "#site ~100h"),
    "projects/a.pbt": "+ALPHA ~90h",
  });
  assert.ok(r.diagnostics.some((d) => d.code === "E005" && d.loc?.file === "projects/a.pbt"));
});
