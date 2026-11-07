import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

const fixture = () => compile([{ path: "plan.pbt", text: `role HW
project +ALPHA 2024-01
project +ALPHABET 2024-01
+ALPHA.section "Design section"
+ALPHA.section.task "Build & review" ~20h ?HW
+ALPHA.unknown "Estimate needed" ?HW
+ALPHA.zero "Zero estimate" ~0h ?HW
+ALPHABET.other "Other project work" ~10h ?HW` }]);

test("work-tree bulk controls target only the work tree", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  assert.match(html, /id="tree-expand-all" aria-controls="work-tree">Expand all<\/button>/);
  assert.match(html, /id="tree-collapse-all" aria-controls="work-tree">Collapse all<\/button>/);
  assert.match(html, /id="tree-count"[^>]*aria-live="polite"/);
});

test("project expansion shows work details even when no people are booked", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  const project = html.match(/<details class="drill" data-project="ALPHA">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(project, /No people are assigned to this project/);
  assert.match(project, /Work breakdown/);
  assert.match(project, /data-project-work="ALPHA.section.task"/);
  assert.match(project, /Build &amp; review/);
  assert.match(project, /20 h effort.*20 h remaining/);
  assert.match(project, /HW/);
  assert.match(project, /2024-01-01.*2024-01-31/);
  assert.doesNotMatch(project, /Other project work|ALPHABET/);
});

test("expanded tree values distinguish missing estimates, zero estimates, and unchanged remaining effort", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  const row = path => html.match(new RegExp(`<tr[^>]*data-tree-path="${path.replaceAll(".", "\\.")}"[^>]*>[^]*?<\\/tr>`))?.[0] ?? "";
  assert.match(row("ALPHA.section.task"), /<td class="num">20<\/td><td class="num">20<\/td>/);
  assert.match(row("ALPHA.unknown"), /Not estimated/);
  assert.match(row("ALPHA.zero"), /<td class="num">0<\/td><td class="num">0<\/td>/);
});
