import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, type SourceFile } from "../src/compile.ts";
import { DateError, fmt, parseRange } from "../src/dates.ts";
import { monthHeaders } from "../src/views.ts";

const run = (text: string) => compile([{ path: "plan.pbt", text }]);
const formatted = (text: string) => {
  const r = parseRange(text);
  return `${fmt(r.start!)}..${fmt(r.end!)}`;
};

test("ISO week 53 must belong to the named ISO year", async (t) => {
  for (const week of ["2021-W53", "2022-W53", "2024-W53", "2024-W00", "2024-W54"]) {
    await t.test(week, () => {
      assert.throws(() => parseRange(week), DateError);
      const r = run(`project +ALPHA ${week}`);
      assert.deepEqual(r.diagnostics.map((d) => [d.code, d.loc]), [["E004", { file: "plan.pbt", line: 1 }]]);
    });
  }
});

test("valid ISO weeks preserve week-year boundaries", () => {
  assert.equal(formatted("2020-W53"), "2020-12-28..2021-01-03");
  assert.equal(formatted("2026-W53"), "2026-12-28..2027-01-03");
  assert.equal(formatted("2015-W01"), "2014-12-29..2015-01-04");
  assert.equal(formatted("2021-W52"), "2021-12-27..2022-01-02");
});

test("four-digit years keep their ISO year instead of JavaScript's 1900 offset", () => {
  assert.equal(formatted("0004-W53"), "0004-12-27..0005-01-02");
  assert.equal(formatted("0004-02-29"), "0004-02-29..0004-02-29");
  assert.deepEqual(monthHeaders(run("role HW\nproject +ALPHA 0004-01\n+ALPHA.task ~10h ?HW").model), ["0004-01"]);
});

test("malformed ranges fail instead of losing endpoints", async (t) => {
  for (const range of ["2024-01..2024-02..2024-03", "2024-01....2024-02", "2024-01..2024-02..", "2024-01..+3m..+2m", "..", "....", "2024-01...2024-02"]) {
    await t.test(range, () => {
      assert.throws(() => parseRange(range), DateError);
      const r = run(`project +ALPHA ${range}`);
      assert.deepEqual(r.diagnostics.map((d) => [d.code, d.loc]), [["E004", { file: "plan.pbt", line: 1 }]]);
    });
  }
});

test("role declarations require an identifier and allow only an optional quoted title", async (t) => {
  for (const text of ["role", 'role "Hardware"', "role HW..SYS", "role +HW", "role HW junk", "role HW role:SYS", 'role HW "unfinished']) {
    await t.test(text, () => {
      const r = run(text);
      assert.deepEqual(r.diagnostics.map((d) => [d.code, d.loc]), [["E001", { file: "plan.pbt", line: 1 }]]);
    });
  }
});

test("duplicate qualified role declarations identify both source locations", () => {
  const r = run('role CONN.SW "Connection software"\nrole CONN.SW "Again"');
  assert.equal(r.diagnostics.length, 1);
  assert.equal(r.diagnostics[0].code, "E005");
  assert.deepEqual(r.diagnostics[0].loc, { file: "plan.pbt", line: 2 });
  assert.match(r.diagnostics[0].msg, /plan.pbt:1/);
});

test("relative ranges reject zero, unsafe, and unrepresentable durations", async (t) => {
  for (const range of ["2024-01..+0d", "2024-01..+9007199254740992d", "2024-01..+1000000000000d", "2024-01..+1000000000000m", `2024-01..+${"9".repeat(400)}w`]) {
    await t.test(range.slice(0, 50), () => {
      assert.throws(() => parseRange(range), DateError);
      assert.ok(run(`project +ALPHA ${range}`).diagnostics.some((d) => d.code === "E004"));
    });
  }
});

test("two date ranges on one fact produce E004 at that line", () => {
  const r = run("# registry\nproject +ALPHA 2024-01 2024-02");
  assert.deepEqual(r.diagnostics.map((d) => [d.code, d.loc]), [["E004", { file: "plan.pbt", line: 2 }]]);
});

test("valid open-ended, mixed-precision, and relative ranges remain supported", () => {
  assert.equal(fmt(parseRange("..2024-02").end!), "2024-02-29");
  assert.equal(parseRange("..2024-02").start, undefined);
  assert.equal(fmt(parseRange("2024-03..").start!), "2024-03-01");
  assert.equal(parseRange("2024-03..").end, undefined);
  assert.equal(formatted("2024-01-15..2024-02"), "2024-01-15..2024-02-29");
  assert.equal(formatted("2024-03..+3m"), "2024-03-01..2024-05-31");
  assert.equal(formatted("2020-W53..2021-W01"), "2020-12-28..2021-01-10");
});

test("qualified role declarations permit quoted titles and comments", () => {
  assert.deepEqual(run('role CONN.SW "Connection software" # description\nrole HW // Hardware').diagnostics, []);
});

test("role references require declarations at the person, node, or task source line", async (t) => {
  for (const text of ["person @alice role:MISSING", "project +ALPHA role:MISSING", "project +ALPHA\n+ALPHA.task ~10h ?MISSING", "project +ALPHA\n+ALPHA.group role:MISSING"]) {
    await t.test(text, () => {
      const r = run(text);
      const errors = r.diagnostics.filter((d) => d.code === "E003");
      assert.equal(errors.length, 1);
      assert.deepEqual(errors[0].loc, { file: "plan.pbt", line: text.split("\n").length });
      assert.match(errors[0].msg, /unknown role MISSING/);
    });
  }
});

test("role references cannot hide missing identifiers or malformed shares", async (t) => {
  for (const line of ["person @alice role:", "person @alice role:HW,,SYS", "project +BETA role:HW..SYS", "+ALPHA.task ~10h ?", "+ALPHA.task ~10h ?HW..SYS", "+ALPHA.task ~10h ?HW:", "+ALPHA.task ~10h ?HW:100%:extra"]) {
    await t.test(line, () => {
      const r = run(`role HW\nrole SYS\nproject +ALPHA\n${line}`);
      assert.ok(r.diagnostics.some((d) => d.code === "E001" && d.loc?.line === 4));
    });
  }
});

test("forward role declarations work across files in either order", () => {
  const files: SourceFile[] = [
    { path: "plan.pbt", text: "person @alice role:HW,CONN.SW\nproject +ALPHA 2024-01 role:HW\n+ALPHA.group role:CONN.SW\n+ALPHA.group.task ~10h\n+ALPHA.other ~10h ?HW" },
    { path: "roles.pbt", text: 'role CONN.SW "Connection software"\nrole HW' },
  ];
  const a = compile(files), b = compile([...files].reverse());
  assert.deepEqual(a.diagnostics.filter((d) => d.level === "error"), []);
  assert.deepEqual(a.diagnostics, b.diagnostics);
});

test("a parent role does not implicitly declare qualified or differently cased roles", () => {
  const r = run("role CONN\nrole HW\nperson @alice role:HW,CONN.SW\nproject +ALPHA\n+ALPHA.task ~10h ?hw");
  const errors = r.diagnostics.filter((d) => d.code === "E003");
  assert.equal(errors.length, 2);
  assert.match(errors[0].msg, /CONN.SW/);
  assert.equal(errors[0].loc?.line, 3);
  assert.match(errors[1].msg, /unknown role hw/);
  assert.equal(errors[1].loc?.line, 5);
});

test("an undeclared default role is reported once instead of on every descendant", () => {
  const r = run("project +ALPHA role:MISSING\n+ALPHA.group\n+ALPHA.group.task ~10h");
  const errors = r.diagnostics.filter((d) => d.code === "E003");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].loc?.line, 1);
});

test("role duplicates across files remain errors even when titles differ", () => {
  const r = compile([
    { path: "a.pbt", text: 'role HW "Hardware"' },
    { path: "b.pbt", text: 'role HW "Another title"' },
  ]);
  assert.equal(r.diagnostics.length, 1);
  assert.equal(r.diagnostics[0].code, "E005");
  assert.deepEqual(r.diagnostics[0].loc, { file: "b.pbt", line: 1 });
  assert.match(r.diagnostics[0].msg, /a.pbt:1/);
});
