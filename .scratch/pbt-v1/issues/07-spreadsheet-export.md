# 07: Spreadsheet export

**What to build:** `pbt xlsx <dir> -o plan.xlsx` writes sheets Diagnostics, Load, Hours, RoleBalance, Tasks, Bookings from the same view functions as the report.

**Blocked by:** 04

**Status:** done (prototype)

- [ ] Numbers in the sheet equal the report's numbers for the same plan
- [ ] Months as columns, one row per person or role

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- Open: no test yet asserts that sheet numbers equal report numbers (criterion 1).
