import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

const run = () => compile([{ path: "plan.pbt", text: `role HW
role SW
calendar TEST 8h/d 100h/m
person @alice "Alice Example" role:HW loc:TEST
project +ALPHA 2024-01
+ALPHA.hardware ~40h ?HW
+ALPHA.software ~60h ?SW
@alice +ALPHA 100%` }]);

test("a project with several roles has one total row and a collapsed role breakdown", () => {
  const { model, diagnostics } = run();
  const html = renderReport(model, diagnostics);
  assert.equal((html.match(/data-balance-project="ALPHA"/g) ?? []).length, 1);
  assert.match(html, /aria-expanded="false" aria-controls="balance-ALPHA"/);
  assert.match(html, /id="balance-ALPHA" hidden/);
  assert.equal((html.match(/data-balance-role="/g) ?? []).length, 2);
  assert.match(html, /Roles \(2\)/);
  assert.match(html, /<summary>\+ALPHA<\/summary>/);
  assert.match(html, /Alice Example/);
});

test("project totals retain the role-shortfall signal when total supply covers total demand", () => {
  const { model, diagnostics } = run();
  const html = renderReport(model, diagnostics);
  const total = html.match(/<tr class="f balance-total" data-balance-project="ALPHA"[^]*?<\/tr>/)?.[0] ?? "";
  assert.match(total, /class="b short"/);
  assert.match(total, /<span>100<\/span><span>100<\/span>/);
  assert.match(total, /role shortfall/);
  assert.match(html, /data-balance-role="SW"/);
  assert.match(html, /<span>60<\/span><span>0<\/span>/);
});
