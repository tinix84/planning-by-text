# 04: Demand spread and role balance

**What to build:** Task effort (or `left:`) is spread uniformly over the working days of its effective window, split across `?roles` by share; supply is credited to each booked person's primary role; the report and lint show demand vs supply per root, role and month.

**Blocked by:** 02, 03

**Status:** done (v1 demand and window regressions verified)

- [x] `after:` with absolute and relative (`.x`, `..x`) paths narrows the start; E006 unresolved, E007 cycle
- [x] Empty predecessors and predecessors without an end date block successors with W106
- [x] Predecessors with only an end date still constrain successor starts
- [x] `?HW:60% ?PCB:40%` splits; no share = equal split
- [x] Mixed role shares split the remainder equally; invalid totals produce E001
- [x] Completion outside 0–100% and non-finite effort or percentages produce E001
- [x] Positive effort without remaining working days produces W110 and remains in the tree totals
- [x] Completed tasks do not produce W110
- [x] W104 when demand exceeds supply for a role in a month; W108 effort with no window
- [x] Role balance table in the report, shortfalls highlighted
- [x] Person roles, node defaults, and task demands reference explicitly declared, case-sensitive role IDs
- [x] Qualified role IDs require exact declarations; declarations may appear later or in another file
- [x] Missing roles produce E003 at their explicit reference, without duplicate errors on inherited descendants
- [x] Missing role-list entries and malformed role-demand tokens produce E001

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: regression tests cover invalid and valid share totals, completion, overdue effort, weekend-only windows, dependency chains, cycles, and inherited bounds. v1 still compares monthly totals per root and role. Daily overload checks and task-level staffing feasibility remain outside this correction.
- 2026-11-06: explicit role declarations are required, including when the registry is otherwise empty. Tests cover primary and secondary references, inherited defaults, qualified IDs, case sensitivity, and file order. Existing real planning files are not migrated.
