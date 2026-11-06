# 01: Walking skeleton: people, bookings, overload lint

**What to build:** A plan folder with person declarations and bookings on declared roots compiles; `pbt lint <dir>` prints file:line diagnostics and exits non-zero on errors. Covers ISO date ranges (inclusive at written precision, relative ends, invalid dates), the default 164 h/month calendar, partial-month working-day proration and per-person monthly load.

**Blocked by:** None (can start immediately)

**Status:** done (parser validation regressions verified)

- [x] `person`, `project` (root only), role declarations, and booking lines parse; syntax errors give E001 with file and line
- [x] E002 unknown root with a suggestion; E003 unknown person, calendar, or role; E004 invalid date/range; E005 duplicate declaration
- [x] Role declarations require a valid identifier and optional quoted title; missing identifiers produce E001
- [x] Duplicate role declarations produce E005 with both source locations
- [x] W101 when monthly load exceeds capacity; W102 for a positive booking on an effective zero-capacity working day
- [x] `2024-01..2024-02`, `2024-Q2`, `2024-W10`, and `2024-03..+3m` resolve as specified
- [x] ISO weeks belong to their named ISO year; valid weeks retain cross-year boundaries
- [x] Chained or empty ranges, multiple ranges per fact, and invalid relative durations produce E004
- [x] Valid open-ended and mixed-precision ranges remain supported
- [x] CLI exits 1 on errors and 0 otherwise; regression tests use compiler and date interfaces

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: regressions in `test/parser-validation.test.ts` cover invalid ISO weeks, malformed ranges, relative-duration limits, declaration syntax, duplicates, and undeclared references. Four-digit years retain their value instead of receiving JavaScript's 1900 offset. Private planning inputs remain unchanged.
