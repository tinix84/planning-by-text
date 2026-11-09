import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

const fixture = () => compile([
  { path: "registry.pbt", text: `role HW
person @alice "Alice <Example>" role:HW
person @bob "Bob Example" role:HW
person @idle "Idle Example" role:HW
project +ALPHA 2024-01
project +ALPHABET 2024-01
project +EMPTY 2024-01
+ALPHA.task "Design & review" ~20h ?HW
+ALPHA.idle "Unstaffed task" ~10h ?HW` },
  { path: "teams/a.pbt", text: "@alice +ALPHA 50%\n@alice +ALPHA.task 25%\n@bob +ALPHABET 100%" },
]);

test("clickable person names expand their bookings with titles, dates, percentages and status", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  const alice = html.match(/<details class="drill" data-person="alice">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(alice, /<summary>Alice &lt;Example&gt;<\/summary>/);
  assert.match(alice, /ALPHA.task/);
  assert.match(alice, /Design &amp; review/);
  assert.match(alice, /25%/);
  assert.match(alice, /2024-01-01.*2024-01-31/);
  assert.match(alice, /confirmed/);
  assert.match(alice, /pin/i);
  assert.doesNotMatch(alice, /Unstaffed task|ALPHABET/);
});

test("project expanders include booked people and descendants without prefix collisions", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics);
  const alpha = html.match(/<details class="drill" data-project="ALPHA">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(alpha, /<summary>\+ALPHA<\/summary>/);
  assert.match(alpha, /Alice &lt;Example&gt;/);
  assert.match(alpha, /ALPHA.task/);
  assert.doesNotMatch(alpha, /Bob Example|ALPHABET/);
  const empty = html.match(/<details class="drill" data-project="EMPTY">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(empty, /No bookings recorded/);
  const idle = html.match(/<details class="drill" data-person="idle">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(idle, /No bookings recorded/);
});

test("drilldowns show active confirmations once and retain separate requested pins", () => {
  const { model, diagnostics } = compile([
    { path: "registry.pbt", text: "person @alice\nproject +ALPHA 2024-01\n+ALPHA.task" },
    { path: "projects/a.pbt", text: "@alice +ALPHA 100%\n@alice +ALPHA.task 20%" },
    { path: "teams/a.pbt", text: "@alice +ALPHA 100%" },
  ]);
  const html = renderReport(model, diagnostics);
  const alice = html.match(/<details class="drill" data-person="alice">[^]*?<\/details>/)?.[0] ?? "";
  assert.equal((alice.match(/<li>/g) ?? []).length, 2);
  assert.match(alice, /confirmed · pool/);
  assert.match(alice, /requested · pin/);
});

test("scenario assumptions remain visibly unverified and escaped", () => {
  const { model, diagnostics } = fixture();
  const html = renderReport(model, diagnostics, { assumptions: ["A01: historical capacity <unverified>"] });
  assert.match(html, /Scenario assumptions — unverified/);
  assert.match(html, /historical capacity &lt;unverified&gt;/);
  assert.doesNotMatch(renderReport(model, diagnostics), /Scenario assumptions — unverified/);
});
