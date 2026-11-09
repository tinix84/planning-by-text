import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";
import { treeRows } from "../src/views.ts";

const fixture = () => compile([{ path: "plan.pbt", text: `role HW
person @alice "Alice Example" role:HW
project +ALPHA 2024-01
project +ALPHABET 2024-01
+ALPHA.section "Design & verification"
+ALPHA.section.task "Build controls" ~20h ?HW
+ALPHA.other ~10h ?HW
+ALPHABET.section.task ~5h ?HW
@alice +ALPHA 50%` }]);

test("work tree initially shows roots and gives each branch its own collapsed toggle", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  assert.match(html, /<tbody id="work-tree">/);
  const root = html.match(/<tr[^>]*data-tree-path="ALPHA"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  const section = html.match(/<tr[^>]*data-tree-path="ALPHA.section"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  const task = html.match(/<tr[^>]*data-tree-path="ALPHA.section.task"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  assert.doesNotMatch(root.split(">")[0], /\bhidden\b/);
  assert.match(root, /class="tree-toggle"[^>]*aria-expanded="false"/);
  assert.match(section.split(">")[0], /\bhidden\b/);
  assert.match(section, /class="tree-toggle"[^>]*aria-expanded="false"/);
  assert.match(task.split(">")[0], /\bhidden\b/);
  assert.doesNotMatch(task, /class="tree-toggle"/);
  assert.match(task, /data-tree-parent="ALPHA.section"/);
  const implicit = html.match(/<tr[^>]*data-tree-path="ALPHABET.section"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  assert.match(implicit, /class="tree-toggle"[^>]*aria-expanded="false"/);
  assert.match(implicit, /undecl/);
});

test("resource dropdowns stay separate from branch toggles and every tree value remains", () => {
  const { model, diagnostics } = fixture();
  const before = treeRows(model);
  const html = renderReport(model, diagnostics);
  const root = html.match(/<tr[^>]*data-tree-path="ALPHA"[^>]*>[^]*?<\/tr>/)?.[0] ?? "";
  assert.match(root, /data-project="ALPHA"><summary>Resources<\/summary>/);
  assert.match(root, /Alice Example/);
  assert.match(html, /Design &amp; verification/);
  for (const row of before) assert.ok(html.includes(`data-tree-path="${row.path}"`));
  assert.deepEqual(treeRows(model), before);
});
