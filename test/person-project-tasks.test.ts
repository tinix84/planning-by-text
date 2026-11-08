import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

const fixture = () => compile([
  { path: "registry.pbt", text: `calendar CH 8h/d 160h/m
person @alice "Alice Example" loc:CH
person @bob "Bob Example" loc:CH
project +ALPHA 2024-01..2024-02
project +ALPHABET 2024-01..2024-02
+ALPHA.section "Design section"
+ALPHA.section.task "Build & review"
+ALPHA.unbooked "Unassigned task" ~10h
+ALPHA.other "Another person's task"` },
  { path: "teams/plan.pbt", text: "@alice +ALPHA 100%\n@alice +ALPHA.section 50% 2024-01\n@alice +ALPHABET 50%\n@bob +ALPHA.other 20%" },
  { path: "projects/plan.pbt", text: "@alice +ALPHA.section.task 25% 2024-01" },
]);

const rowsFor = (html: string, owner: string) => [...html.matchAll(new RegExp(`<tr[^>]*data-person-task="[^"]*"[^>]*data-owner="${owner}"[^>]*>[^]*?</tr>`, "g"))].map(m => m[0]);
const rowFor = (html: string, path: string) => rowsFor(html, "alice").find(r => r.includes(`data-person-task="${path}"`)) ?? "";

test("person project toggles expose only that person's recorded descendant booking paths", () => {
  const { model, diagnostics } = fixture();
  assert.equal(diagnostics.filter(d => d.level === "error").length, 0);
  const html = renderReport(model, diagnostics);
  const project = html.match(/<tr[^>]*data-person-project="ALPHA"[^>]*data-owner="alice"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  assert.match(project, /class="person-project-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/);
  assert.match(project, /aria-label="Expand ALPHA for Alice Example"/);
  const tasks = rowsFor(html, "alice");
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every(r => / hidden>/.test(r)));
  assert.ok(tasks.some(r => r.includes("Build &amp; review")));
  assert.doesNotMatch(tasks.join(""), /Unassigned task|Another person|ALPHABET/);
  const noTasks = html.match(/<tr[^>]*data-person-project="ALPHABET"[^>]*data-owner="alice"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  assert.match(noTasks, /No task bookings/);
  assert.doesNotMatch(noTasks, /person-project-toggle/);
});

test("task and residual pool rows reconcile to project totals without double-counting nested pins", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  assert.match(rowFor(html, "ALPHA"), /Project pool.*not assigned to a task/);
  assert.match(rowFor(html, "ALPHA.section"), /Section pool.*remaining hours/);
  assert.match(rowFor(html, "ALPHA"), /data-month="2024-01" data-hours="80"/);
  assert.match(rowFor(html, "ALPHA.section"), /data-month="2024-01" data-hours="40"/);
  assert.match(rowFor(html, "ALPHA.section.task"), /data-month="2024-01" data-hours="40"[^>]*>40 h/);
  assert.match(rowFor(html, "ALPHA.section.task"), /0 h confirmed · 40 h requested · 0 h unspecified/);
  assert.match(rowFor(html, "ALPHA.section.task"), /data-month="2024-02" data-hours="0"[^>]*>—/);
  for (const month of ["2024-01", "2024-02"]) {
    const hours = rowsFor(html, "alice").map(r => Number(r.match(new RegExp(`data-month="${month}" data-hours="([^"]+)"`))?.[1]));
    assert.equal(hours.reduce((sum, h) => sum + h, 0), 160);
  }
});

test("a direct task booking needs no project pool and exact confirmations appear once", () => {
  const { model, diagnostics } = compile([
    { path: "registry.pbt", text: "person @alice\nproject +ALPHA 2024-01\n+ALPHA.task" },
    { path: "projects/plan.pbt", text: "@alice +ALPHA.task 50%" },
    { path: "teams/plan.pbt", text: "@alice +ALPHA.task 50%" },
  ]);
  const rows = rowsFor(renderReport(model, diagnostics), "alice");
  assert.equal(rows.length, 1);
  assert.match(rows[0], /data-person-task="ALPHA.task"/);
  assert.match(rows[0], /data-hours="82"/);
  assert.match(rows[0], /82 h confirmed · 0 h requested/);
});
