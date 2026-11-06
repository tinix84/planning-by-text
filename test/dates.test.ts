import { test } from "node:test";
import assert from "node:assert/strict";
import { DateError, fmt, parseRange, workdaysByMonth } from "../src/dates.ts";

const r = (s: string) => { const x = parseRange(s); return `${fmt(x.start!)}..${fmt(x.end!)}`; };

test("ranges are inclusive at the precision written", () => {
  assert.equal(r("2024-01..2024-02"), "2024-01-01..2024-02-29");
  assert.equal(r("2024-Q2"), "2024-04-01..2024-06-30");
  assert.equal(r("2024-03"), "2024-03-01..2024-03-31");
  assert.equal(r("2024-03-01..2024-03-15"), "2024-03-01..2024-03-15");
  assert.equal(r("2024"), "2024-01-01..2024-12-31");
});

test("ISO weeks start on Monday", () => {
  assert.equal(r("2024-W10"), "2024-03-04..2024-03-10");
  assert.equal(r("2021-W01"), "2021-01-04..2021-01-10");
});

test("relative ends", () => {
  assert.equal(r("2024-03..+3m"), "2024-03-01..2024-05-31");
  assert.equal(r("2024-03-04..+2w"), "2024-03-04..2024-03-17");
  assert.equal(r("2024-01-31..+1m"), "2024-01-31..2024-02-28");
});

test("dates that do not exist are errors", () => {
  assert.throws(() => parseRange("2024-04-31"), DateError);
  assert.throws(() => parseRange("2023-02-29"), DateError);
  assert.throws(() => parseRange("2024-13"), DateError);
  assert.throws(() => parseRange("2024-03..2024-01"), DateError);
});

test("open ends are left undefined for inheritance", () => {
  const x = parseRange("2024-03..");
  assert.equal(fmt(x.start!), "2024-03-01");
  assert.equal(x.end, undefined);
});

test("working days per month", () => {
  const wd = workdaysByMonth(parseRange("2024-01").start!, parseRange("2024-02").end!);
  assert.deepEqual([...wd.values()], [23, 21]);
});
