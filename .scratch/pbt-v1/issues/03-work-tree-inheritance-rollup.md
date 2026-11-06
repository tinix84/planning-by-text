# 03: Work tree: tasks, inheritance, roll-up

**What to build:** Task lines with dotted paths build the tree under declared roots; children inherit window, tags and calendar; effort rolls up; the report gains a tree section with effort per node.

**Blocked by:** 01

**Status:** done (prototype)

- [ ] Children created on first use; W103 for a path used by bookings but never declared
- [ ] W106 child window outside parent; parent `~budget` smaller than children's sum is a warning
- [ ] Effort units h, d, pm
- [ ] Tree section in the report shows path, title, effort, roles, window

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
