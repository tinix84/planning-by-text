# 03: Work tree: tasks, inheritance, roll-up

**What to build:** Task lines with dotted paths build the tree under declared roots; children inherit window, tags and calendar; effort rolls up; the report gains a tree section with effort per node.

**Blocked by:** 01

**Status:** done (inheritance and syntax regressions verified)

- [x] Children created on first use; W103 for a path used by bookings but never declared
- [x] W106 identifies child windows outside the parent; effective windows use the intersection
- [x] Empty parent windows block descendants, including children with explicit dates
- [x] Partial parent bounds, including dependency starts, constrain descendants
- [x] Parent budget smaller than children's sum produces W109 when written on a separate task line
- [x] Tags, calendar, and default role flow through explicit and implicit descendants
- [x] Tags combine without duplicates; explicit role lists and location calendars override inherited defaults
- [x] Documented `project +ROOT ... ~budget` syntax parses directly; duplicate root budgets produce E005
- [x] Effort and remaining-effort units h, d, pm use the selected calendar where required
- [x] Unknown node calendars produce E003; invalid hour factors produce E001
- [x] Tree section in the report shows full path, title, effort, roles, and window

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: window regressions pass in `test/calculation-regressions.test.ts`. Children cannot regain dates outside an empty or narrowed parent. Remaining work includes tag/calendar/default-role inheritance, project budget syntax, calendar-based person-month conversion, and full paths in the HTML tree.
- 2026-11-06: remaining criteria pass in `test/inheritance-status.test.ts`. Node `loc:` selects inherited effort conversions, including `left:`. Person calendars still determine booking hours. Full HTML paths preserve descendant rows under project filtering.
