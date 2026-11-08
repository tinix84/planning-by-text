import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

test("person bulk controls target the monthly person view separately from the work tree", () => {
  const { model, diagnostics } = compile([{ path: "plan.pbt", text: "person @alice\nproject +ALPHA 2024-01\n+ALPHA.task\n@alice +ALPHA 100%\n@alice +ALPHA.task 25%" }]);
  const html = renderReport(model, diagnostics);
  const section = html.slice(html.indexOf("<h2>Load per person"), html.indexOf("<h2>Demand vs forecast"));
  assert.match(section, /type="button" id="person-expand-all" aria-controls="person-load">Expand all<\/button>/);
  assert.match(section, /type="button" id="person-collapse-all" aria-controls="person-load">Collapse all<\/button>/);
  assert.match(section, /<tbody id="person-load">/);
  assert.match(html, /id="tree-expand-all" aria-controls="work-tree"/);
  assert.match(html, /id="tree-collapse-all" aria-controls="work-tree"/);
});
