import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

const fixture = () => compile([
  { path: "registry.pbt", text: `calendar CH 8h/d 160h/m
person @alice "Alice Example" loc:CH
person @idle
project +ALPHA 2024-01..2024-02
project +ALPHABET 2024-01..2024-02
+ALPHA.task` },
  { path: "teams/plan.pbt", text: "@alice +ALPHA 100%\n@alice +ALPHABET 50% 2024-02" },
  { path: "projects/plan.pbt", text: "@alice +ALPHA.task 25% 2024-01" },
]);

const projectRow = (html: string, root: string) => html.match(new RegExp(`<tr[^>]*data-person-project="${root}"[^>]*>[^]*?</tr>`))?.[0] ?? "";

test("expanded people have project hours aligned to the report month columns", () => {
  const { model, diagnostics } = fixture();
  assert.equal(diagnostics.filter(d => d.level === "error").length, 0);
  const html = renderReport(model, diagnostics);
  const alpha = projectRow(html, "ALPHA");
  assert.match(alpha, /data-owner="alice"[^>]*hidden/);
  assert.match(alpha, /scope="row"/);
  assert.match(alpha, /\+ALPHA/);
  assert.match(alpha, /data-month="2024-01" data-hours="160"[^>]*>160 h<\/td>/);
  assert.match(alpha, /data-month="2024-02" data-hours="160"[^>]*>160 h<\/td>/);
  const alphabet = projectRow(html, "ALPHABET");
  assert.match(alphabet, /data-month="2024-01" data-hours="0"[^>]*>—<\/td>/);
  assert.match(alphabet, /data-month="2024-02" data-hours="80"[^>]*>80 h<\/td>/);
  assert.doesNotMatch(html, /data-owner="idle"/);
});

test("project rows count pins once and retain their requested status", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  const row = projectRow(html, "ALPHA");
  assert.match(row, /120 h confirmed · 40 h requested · 0 h unspecified/);
  assert.doesNotMatch(row, /200 h/);
  for (const [i, month] of model.months.entries()) {
    const projects = projectRow(html, "ALPHA") + projectRow(html, "ALPHABET");
    const values = [...projects.matchAll(new RegExp(`data-month="2024-0${i + 1}" data-hours="([^"]+)"`, "g"))].map(m => Number(m[1]));
    assert.equal(values.reduce((sum, h) => sum + h, 0), model.load.get("alice")!.get(month)!.hours);
  }
});
