# 04: Demand spread and role balance

**What to build:** Task effort (or `left:`) is spread uniformly over the working days of its effective window, split across `?roles` by share; supply is credited to each booked person's primary role; the report and lint show demand vs supply per root, role and month.

**Blocked by:** 02, 03

**Status:** needs-triage

- [ ] `after:` with absolute and relative (`.x`, `..x`) paths narrows the start; E006 unresolved, E007 cycle
- [ ] `?HW:60% ?PCB:40%` splits; no share = equal split
- [ ] W104 when demand exceeds supply for a role in a month; W108 effort with no window
- [ ] Role balance table in the report, shortfalls highlighted
