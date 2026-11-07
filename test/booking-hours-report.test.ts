import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.ts";
import { renderReport } from "../src/report.ts";

test("monthly load values include percentage units", () => {
  const { model, diagnostics } = compile([{ path: "plan.pbt", text: "person @alice\nproject +ALPHA 2024-01\n@alice +ALPHA 100%" }]);
  assert.match(renderReport(model, diagnostics), /<td class="h f"[^>]*>100%<\/td>/);
});

test("booking details show calendar-aware hours beside each path for the full booking window", () => {
  const { model, diagnostics } = compile([{ path: "teams/plan.pbt", text: `calendar CH 8h/d 160h/m
person @alice loc:CH
project +ALPHA 2024-01..2024-02
+ALPHA.task
@alice +ALPHA 100%
@alice +ALPHA.task 25% 2024-01-01..2024-01-15` }]);
  assert.equal(diagnostics.filter(d => d.level === "error").length, 0);
  const html = renderReport(model, diagnostics);
  const person = html.match(/<details class="drill" data-person="alice">[^]*?<\/details>/)?.[0] ?? "";
  assert.match(person, /\+ALPHA<\/span> <strong class="booking-hours">320 h booked<\/strong>/);
  const pin = model.bookings.find(b => b.path === "ALPHA.task")!;
  const hours = Math.round([...pin.hours.values()].reduce((sum, h) => sum + h, 0));
  assert.match(person, new RegExp(`\\+ALPHA.task</span> <strong class="booking-hours">${hours} h booked</strong>`));
  assert.match(person, /Hours cover each booking's date range/);
  assert.match(person, /Pins consume their pool/);
  assert.match(html, /data-project="ALPHA"[^]*?320 h booked/);
});
