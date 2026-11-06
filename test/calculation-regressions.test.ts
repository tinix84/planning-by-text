import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, type SourceFile } from "../src/compile.ts";
import { dayNum } from "../src/dates.ts";
import { loadPct, loadRows, monthHeaders, roleRows, treeRows } from "../src/views.ts";

const registry = `role HW
role SYS
role TEST
calendar TEST 8h/d 230h/m
person @alice "Alice Example" cap:100% role:HW loc:TEST
project +ALPHA 2024-01..2024-06`;
const run = (text: string, asOf?: number) => compile([
  { path: "registry.pbt", text: registry },
  { path: "teams/test.pbt", text },
], { asOf });
type Result = ReturnType<typeof compile>;
const cell = (r: Result, person = "alice", month = "2024-01") =>
  loadRows(r.model).find((x) => x.person === person)!.cells[monthHeaders(r.model).indexOf(month)]!;
const demand = (r: Result) => roleRows(r.model).reduce((sum, row) => sum + row.demand.reduce((a, b) => a + b, 0), 0);

test("overlapping capacity changes are errors and cannot inflate availability", () => {
  const r = run("@alice cap:50% 2024-01\n@alice cap:80% 2024-01\n@alice +ALPHA 120% 2024-01");
  assert.ok(r.diagnostics.some((d) => d.code === "E008" && d.level === "error" && d.loc?.line === 2));
  assert.equal(cell(r).capHours, 115);
  assert.equal(loadPct(cell(r)), 2.4);
  assert.ok(r.diagnostics.some((d) => d.code === "W101"));
});

test("capacity warnings use the override instead of a zero baseline", () => {
  const r = run("person @returning cap:0% role:HW loc:TEST\n@returning cap:100% 2024-01\n@returning +ALPHA 200% 2024-01");
  assert.equal(loadPct(cell(r, "returning")), 2);
  assert.ok(r.diagnostics.some((d) => d.code === "W101"));
  assert.ok(!r.diagnostics.some((d) => d.code === "W102"));
});

test("a nested task pin consumes its immediate pool before the project pool", () => {
  const r = run("+ALPHA.group\n+ALPHA.group.task ~100h ?HW 2024-01\n@alice +ALPHA 100% 2024-01\n@alice +ALPHA.group 60% 2024-01\n@alice +ALPHA.group.task 60% 2024-01");
  assert.equal(loadPct(cell(r)), 1);
  assert.ok(!r.diagnostics.some((d) => d.code === "W101" || d.code === "W105"));
  assert.equal(roleRows(r.model).find((x) => x.role === "HW")!.supply[0], 230);
});

test("invalid role shares cannot create or discard task demand", async (t) => {
  for (const roles of ["?HW:20% ?SYS:20%", "?HW:80% ?SYS:80%", "?HW:120% ?SYS", "?HW:100% ?SYS:20% ?TEST"]) {
    await t.test(roles, () => {
      const r = run(`+ALPHA.task ~100h ${roles} 2024-01`);
      assert.ok(r.diagnostics.some((d) => d.code === "E001" && d.loc?.line === 1));
      assert.equal(demand(r), 0);
    });
  }
});

test("completion above 100 percent is rejected instead of creating negative demand", () => {
  const r = run("+ALPHA.task ~100h done:150% ?HW 2024-01");
  assert.ok(r.diagnostics.some((d) => d.code === "E001"));
  assert.equal(demand(r), 0);
});

test("remaining effort after the deadline stays visible with a diagnostic", () => {
  const r = run("+ALPHA.task ~100h left:50h ?HW 2024-01", dayNum(2024, 2, 1));
  assert.ok(r.diagnostics.some((d) => d.code === "W110" && d.loc?.line === 1 && /50 h/.test(d.msg)));
  assert.equal(treeRows(r.model).find((x) => x.path === "ALPHA.task")!.remaining, 50);
  assert.equal(demand(r), 0);
});

test("a child window is intersected with its parent before demand is spread", () => {
  const r = run("+ALPHA.task ~100h ?HW 2024-05..2024-08");
  assert.ok(r.diagnostics.some((d) => d.code === "W106"));
  assert.equal(treeRows(r.model).find((x) => x.path === "ALPHA.task")!.window, "2024-05-01..2024-06-30");
  assert.deepEqual(monthHeaders(r.model), ["2024-05", "2024-06"]);
  assert.equal(Math.round(demand(r)), 100);
});

test("an empty parent window blocks explicitly dated descendants", () => {
  const r = run("+ALPHA.before ~10h ?HW\n+ALPHA.group after:.before\n+ALPHA.group.child ~100h ?HW 2024-01");
  assert.equal(treeRows(r.model).find((x) => x.path === "ALPHA.group.child")!.window, "");
  assert.equal(Math.round(demand(r)), 10);
  assert.ok(r.diagnostics.some((d) => d.code === "W106" && d.loc?.line === 3));
});

test("a task cannot follow a predecessor with an empty window", () => {
  const r = run("+ALPHA.before ~10h ?HW\n+ALPHA.blocked ~20h ?HW after:.before\n+ALPHA.later ~30h ?HW after:.blocked 2024-01");
  assert.equal(treeRows(r.model).find((x) => x.path === "ALPHA.later")!.window, "");
  assert.equal(Math.round(demand(r)), 10);
  assert.ok(r.diagnostics.some((d) => d.code === "W106" && d.loc?.line === 3));
});

test("a dependency start on an open-ended parent constrains its child", () => {
  const r = run("project +OPEN\n+OPEN.before ~10h ?HW 2024-02\n+OPEN.group after:.before\n+OPEN.group.child ~100h ?HW 2024-01..2024-06");
  assert.equal(treeRows(r.model).find((x) => x.path === "OPEN.group.child")!.window, "2024-03-01..2024-06-30");
  assert.ok(r.diagnostics.some((d) => d.code === "W106" && d.loc?.line === 4));
});

test("a predecessor with only an end date still constrains its successor", () => {
  const r = run("project +OPEN\n+OPEN.before ..2024-02\n+OPEN.after ~100h ?HW after:.before 2024-01..2024-06");
  assert.equal(treeRows(r.model).find((x) => x.path === "OPEN.after")!.window, "2024-03-01..2024-06-30");
});

test("a predecessor without an end date cannot silently lose its constraint", () => {
  const r = run("project +OPEN\n+OPEN.before 2024-01..\n+OPEN.after ~100h ?HW after:.before 2024-02");
  assert.ok(r.diagnostics.some((d) => d.code === "W106" && d.loc?.line === 3));
  assert.equal(demand(r), 0);
});

test("effort and percentages must be finite", async (t) => {
  const huge = "9".repeat(400);
  for (const text of [`+ALPHA.task ~${huge}h ?HW 2024-01`, `+ALPHA.task ~100h left:${huge}h ?HW`, `@alice cap:${huge}% 2024-01`, `@alice +ALPHA ${huge}% 2024-01`]) {
    await t.test(text.slice(0, 30), () => {
      const r = run(text);
      assert.ok(r.diagnostics.some((d) => d.code === "E001"));
      assert.equal(demand(r), 0);
    });
  }
});

test("zero-capacity warnings detect partial leave inside the booking only", () => {
  const r = run("@alice cap:0% 2024-01-01..2024-01-15\n@alice +ALPHA 100% 2024-01-01..2024-01-15\n@alice +ALPHA 0% 2024-01\n@alice +ALPHA 100% 2024-02");
  assert.equal(Math.round(cell(r).capHours), 120);
  assert.deepEqual(r.diagnostics.filter((d) => d.code === "W102").map((d) => d.loc?.line), [2]);
});

test("adjacent capacity changes apply once to each working day", () => {
  const r = run("@alice cap:50% 2024-01-01..2024-01-15\n@alice cap:80% 2024-01-16..2024-01-31\n@alice +ALPHA 100% 2024-01");
  assert.equal(Math.round(cell(r).capHours), 151);
  assert.ok(!r.diagnostics.some((d) => d.code === "E008"));
});

test("capacity conflicts give the same availability in either file order", () => {
  const files: SourceFile[] = [
    { path: "registry.pbt", text: registry },
    { path: "teams/a.pbt", text: "@alice cap:50% 2024-01" },
    { path: "teams/b.pbt", text: "@alice cap:80% 2024-01\n@alice +ALPHA 120% 2024-01" },
  ];
  const forward = compile(files), reverse = compile([...files].reverse());
  assert.equal(cell(forward).capHours, 115);
  assert.equal(cell(reverse).capHours, 115);
  assert.deepEqual(forward.diagnostics, reverse.diagnostics);
});

test("a nested pool overflow warns at that pool without inflating the project", () => {
  const r = run("+ALPHA.group\n+ALPHA.group.one\n+ALPHA.group.two\n@alice +ALPHA 100% 2024-01\n@alice +ALPHA.group 60% 2024-01\n@alice +ALPHA.group.one 40% 2024-01\n@alice +ALPHA.group.two 40% 2024-01");
  assert.equal(loadPct(cell(r)), 1);
  const warnings = r.diagnostics.filter((d) => d.code === "W105");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].msg, /under \+ALPHA.group need 184 h/);
});

test("sibling pins add after each nested pool is counted once", () => {
  const r = run("+ALPHA.group\n+ALPHA.group.task\n+ALPHA.other\n@alice +ALPHA 100% 2024-01\n@alice +ALPHA.group 60% 2024-01\n@alice +ALPHA.group.task 60% 2024-01\n@alice +ALPHA.other 50% 2024-01");
  assert.equal(Math.round(cell(r).hours), 253);
  assert.equal(r.diagnostics.filter((d) => d.code === "W105").length, 1);
  assert.ok(r.diagnostics.some((d) => d.code === "W101"));
});

test("multiple bookings on one pool do not each count the same pin", () => {
  const r = run("+ALPHA.task\n@alice +ALPHA 25% 2024-01\n@alice +ALPHA 25% 2024-01\n@alice +ALPHA.task 40% 2024-01");
  assert.equal(loadPct(cell(r)), 0.5);
  assert.ok(!r.diagnostics.some((d) => d.code === "W105"));
});

test("valid equal, explicit, and mixed role shares preserve total demand", async (t) => {
  for (const roles of ["?HW ?SYS", "?HW:60% ?SYS:40%", "?HW:25% ?SYS ?TEST", "?HW:0% ?SYS:100%", "?HW:100% ?SYS"]) {
    await t.test(roles, () => {
      const r = run(`+ALPHA.task ~100h ${roles} 2024-01`);
      assert.equal(demand(r), 100);
      assert.ok(!r.diagnostics.some((d) => d.level === "error"));
    });
  }
});

test("completed effort does not produce an overdue warning", () => {
  const r = run("+ALPHA.task ~100h done:100% ?HW 2024-01", dayNum(2024, 2, 1));
  assert.equal(demand(r), 0);
  assert.ok(!r.diagnostics.some((d) => d.code === "W110"));
});

test("positive effort in a weekend-only window gets a diagnostic", () => {
  const r = run("+ALPHA.task ~100h ?HW 2024-01-06..2024-01-07");
  assert.ok(r.diagnostics.some((d) => d.code === "W110"));
  assert.equal(demand(r), 0);
});

test("a wholly disjoint child cannot create demand outside its root", () => {
  const r = run("+ALPHA.task ~100h ?HW 2025-01");
  assert.equal(treeRows(r.model).find((x) => x.path === "ALPHA.task")!.window, "");
  assert.equal(demand(r), 0);
  assert.ok(r.diagnostics.some((d) => d.code === "W106"));
});

test("dependency cycles keep their tasks and descendants out of demand", () => {
  const r = run("+ALPHA.a ~10h ?HW after:.b\n+ALPHA.b ~20h ?HW after:.a\n+ALPHA.a.child ~100h ?HW 2024-01");
  assert.ok(r.diagnostics.some((d) => d.code === "E007"));
  assert.equal(demand(r), 0);
  assert.ok(treeRows(r.model).filter((x) => x.path !== "ALPHA").every((x) => x.window === ""));
});
