import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { profileRows, treeRows } from "../src/views.ts";

const catalog = `competency CIRCUITS "Circuit design"
competency REVIEW "Design review"
competency SAFETY "Safety"
profile SeniorHW "Senior hardware" CIRCUITS:3 REVIEW:2 SAFETY:2
assessment @alice active:true CIRCUITS:4 REVIEW:1 SAFETY:0`;
const plan = `role HW
person @alice "Alice Example" role:HW
project +ALPHA 2024-01
+ALPHA.design ~164h ?HW profile:SeniorHW
@alice +ALPHA.design 100%`;

test("qualification gaps and unknown assessments warn without changing forecast supply", () => {
  const result = compile([{ path: "plan.pbt", text: plan }, { path: "profiles.pbt", text: catalog }]);
  assert.deepEqual(result.diagnostics.filter((d) => d.level === "error"), []);
  assert.match(result.diagnostics.find((d) => d.code === "W111")?.msg ?? "", /REVIEW.*1.*2/);
  assert.match(result.diagnostics.find((d) => d.code === "W112")?.msg ?? "", /SAFETY/);
  const baseline = compile([{ path: "plan.pbt", text: plan.replace(" profile:SeniorHW", "") }]);
  assert.deepEqual(result.model.supply, baseline.model.supply);
  assert.deepEqual(result.model.demand, baseline.model.demand);
  assert.deepEqual(result.model.load, baseline.model.load);
});

test("matching reports minimum coverage, gaps and unknowns without rewarding excess levels", () => {
  const extra = `person @bob role:HW
person @carol role:HW
person @dave role:HW
assessment @bob active:true CIRCUITS:3 REVIEW:2 SAFETY:2
assessment @carol active:false CIRCUITS:4 REVIEW:4 SAFETY:4
profile Empty CIRCUITS:0`;
  const { model } = compile([{ path: "plan.pbt", text: `${plan}\n${catalog}\n${extra}` }]);
  const rows = profileRows(model, "SeniorHW");
  assert.deepEqual(rows.map((r) => [r.person, r.coverage]), [["bob", 1], ["alice", 1 / 3], ["dave", 0]]);
  assert.deepEqual(rows[1].checks.map((c) => [c.competency, c.status]), [["CIRCUITS", "meets"], ["REVIEW", "below"], ["SAFETY", "unknown"]]);
  assert.equal(rows[2].checks.every((c) => c.actual === undefined && c.status === "unknown"), true);
  assert.equal(profileRows(model, "SeniorHW", true).length, 4);
  assert.equal(profileRows(model, "Empty")[0].coverage, undefined);
});

test("profile requirements inherit through implicit nodes and explicit children replace them", () => {
  const text = `role HW
person @alice role:HW
${catalog}
profile Junior CIRCUITS:1
project +ALPHA 2024-01 profile:SeniorHW
+ALPHA.group.task ~20h ?HW
+ALPHA.easy ~20h ?HW profile:Junior
@alice +ALPHA.group.task 20%
@alice +ALPHA.easy 20%`;
  const files = text.split("\n").map((text, i) => ({ path: `${i}.pbt`, text }));
  const result = compile(files), reversed = compile([...files].reverse());
  assert.deepEqual(result.diagnostics, reversed.diagnostics);
  assert.equal(treeRows(result.model).find((r) => r.path === "ALPHA.group.task")?.profile, "SeniorHW");
  assert.deepEqual(result.diagnostics.filter((d) => ["W111", "W112"].includes(d.code)).map((d) => d.loc?.line), [1, 1]);
  assert.ok(result.diagnostics.filter((d) => ["W111", "W112"].includes(d.code)).every((d) => d.msg.includes("+ALPHA.group.task")));
});

test("replaced requests produce one qualification warning and inactive bookings stay in supply", () => {
  const requested = `${plan}\n${catalog.replace("active:true", "active:false")}`;
  const { model, diagnostics } = compile([{ path: "projects/a.pbt", text: requested }, { path: "teams/a.pbt", text: "@alice +ALPHA.design 100%" }]);
  for (const code of ["W111", "W112", "W113"]) assert.equal(diagnostics.filter((d) => d.code === code).length, 1);
  assert.equal(model.bookings.length, 1);
  assert.equal([...model.supply.get("ALPHA")!.get("HW")!.values()][0], 164);
});

test("pools do not imply a qualification assignment to every descendant", () => {
  const { diagnostics } = compile([{ path: "plan.pbt", text: `${plan.replace("@alice +ALPHA.design", "@alice +ALPHA")}\n${catalog}` }]);
  assert.ok(!diagnostics.some((d) => ["W111", "W112"].includes(d.code)));
});

test("unknown declarations and references retain their source locations", () => {
  const text = `competency CIRCUITS
profile Senior CIRCUITS:3 MISSING:2
assessment @ghost CIRCUITS:1
project +ALPHA profile:Typo
+ALPHA.task ~10h`;
  const { diagnostics } = compile([{ path: "invalid.pbt", text }]);
  assert.deepEqual(diagnostics.filter((d) => d.code === "E003").map((d) => d.loc?.line), [2, 3, 4]);
});

test("duplicates fail instead of combining profiles or assessments", () => {
  const { diagnostics } = compile([{ path: "duplicates.pbt", text: `person @alice
competency S
competency S
profile P S:2
profile P S:4
assessment @alice S:1
assessment @alice S:4` }]);
  assert.deepEqual(diagnostics.filter((d) => d.code === "E005").map((d) => d.loc?.line), [3, 5, 7]);
});

test("invalid competency syntax and levels fail at the parser", async (t) => {
  for (const text of ["competency", "competency BAD..ID", "profile", "profile P S:5", "profile P S:-1", "profile P S:1.5", "profile P S:NaN", "profile P S:2 S:3", "assessment alice S:1", "assessment @alice active:yes", "assessment @alice active:true active:false", "project +ALPHA profile:", "project +ALPHA profile:A,B", "project +ALPHA profile:A profile:B", "person @alice profile:P", "@alice +ALPHA 100% profile:P"]) {
    await t.test(text, () => assert.equal(compile([{ path: "invalid.pbt", text }]).diagnostics[0].code, "E001"));
  }
});
