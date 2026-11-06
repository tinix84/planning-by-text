# Spec: Planning by Text v1

Status: ready-for-agent

## Problem Statement

A matrix engineering organisation plans people across many projects with two disconnected artefacts: a bottom-up spreadsheet of effort per activity and role, and a top-down list of who works on which project at what percentage. The list is written in three half-compatible notations (markdown bullets, Mermaid gantt, PlantUML gantt) and nobody checks it. As a result:

- people are booked at 200–400% without anyone noticing;
- project names drift (`4xLLC_DC_Charging` vs `TDP_4xLLC_DC_Charging`, `ePDU Stellantis` vs `ePDU_Stellantis`);
- invalid dates (`31.04.2024`) and mixed inclusive/exclusive ends make monthly totals wrong by a month;
- nobody can answer "which roles are we short of in Q2?", because demand per role and supply per person never meet;
- issue trackers such as Jira record tickets and logged hours, but none of them plans capacity.

## Solution

A small plain-text language, one fact per line, with sigils (`@` person, `+` work path, `?` role demand, `~` effort, `%` load, `..` date range, `#` tag), stored as text files in git. A command-line tool compiles all files of a plan into one model and:

- lints them (unknown names, impossible dates, overbookings, shortfalls);
- writes a single self-contained HTML report with a person × month load heatmap, a role demand-vs-supply table and a work-tree roll-up;
- exports the same tables to a spreadsheet.

A one-off importer converts the existing allocation list and effort spreadsheet into the new notation. The files stay the only source of truth (ADR 0001).

## User Stories

1. As a line manager, I want to declare each person once with their capacity and primary role, so that every booking refers to a known person.
2. As a line manager, I want to book a person on a project for a percentage over a month range in one line, so that planning is as fast as typing.
3. As a line manager, I want to see each person's load per month as a colour-coded heatmap, so that I spot overbookings at a glance.
4. As a line manager, I want a warning when a person's bookings exceed their capacity in any month, so that overbookings cannot go unnoticed.
5. As a line manager, I want a warning when someone with zero capacity is booked, so that I notice bookings on people who left or are on leave.
6. As a line manager, I want to express a temporary capacity change (part-time months, parental leave) as a line, so that load is computed against the real capacity.
7. As a project manager, I want to write a task with its effort and the roles it needs, so that demand is recorded where I estimate it.
8. As a project manager, I want to nest tasks under a project with dotted paths, so that the plan mirrors my work breakdown.
9. As a project manager, I want children to inherit the project's window and tags, so that I do not repeat them on every task.
10. As a project manager, I want effort to roll up to every parent node, so that I see totals per work package and project.
11. As a project manager, I want a warning when children's effort exceeds the parent's budget, so that I see when the estimate has outgrown the budget.
12. As a project manager, I want to declare that a task starts after another task, so that its demand falls in the right months.
13. As a project manager, I want to split a task's effort between roles by percentage, so that mixed tasks are demanded correctly.
14. As a project manager, I want to record remaining effort on a task, so that only the work still to do is spread over the remaining months.
15. As a project manager, I want to request a person by writing a booking in my project file, so that the line manager sees the request without a separate tool.
16. As a line manager, I want bookings in my team files to count as confirmed and bookings in project files as requested, so that the report shows which commitments are agreed.
17. As a PMO, I want to see demand vs supply per role and month for each root, so that I know which roles to hire or rebalance.
18. As a PMO, I want an error for any reference to an undeclared root, with a "did you mean" suggestion, so that typos never create phantom projects.
19. As a PMO, I want a warning for paths that bookings use but no task line declares, so that misspelled task names are caught.
20. As a PMO, I want duplicate declarations reported, so that the registry stays unambiguous.
21. As any editor, I want dates that do not exist to be errors, so that `2024-04-31` cannot slip through.
22. As any editor, I want date ranges to be inclusive at the precision I wrote (month, quarter, ISO week, day), so that `2024-01..2024-02` means January and February.
23. As any editor, I want relative range ends such as `..+3m`, so that I can state durations without computing end dates.
24. As any editor, I want comments in plan files, so that I can explain assumptions next to the line.
25. As any editor, I want every diagnostic to name the file and line, so that I can jump straight to the problem.
26. As a CI pipeline, I want the lint command to exit non-zero on errors, so that broken plans cannot be merged.
27. As a manager without git, I want one HTML file I can open from email, so that I can read the plan without installing anything.
28. As a manager, I want to filter the report by text (person, project, role), so that I see only what concerns me.
29. As a controller, I want a spreadsheet export of load, hours, role balance, tasks and bookings, so that I can pivot the numbers myself.
30. As a planner, I want booking hours computed from location calendars (hours per month), so that sites with different working times are compared correctly.
31. As a planner, I want a booking that covers part of a month to count only the working days it covers, so that monthly totals are exact.
32. As a planner, I want a pin on a task to consume the same person's pool on the parent, never add to it, so that hours are never counted twice.
33. As a planner, I want a warning when pins exceed their pool, so that I see when a task booking is larger than the project booking around it.
34. As a migrating team, I want the existing allocation list and effort spreadsheet converted into plan files, so that adoption starts from real data.
35. As a migrating team, I want the importer to keep legacy errors visible (typos, invalid dates, unknown projects) rather than silently fixing them, so that the first lint run shows what was wrong.
36. As a migrating team, I want legacy "to 01.MM.YYYY" ends imported as exclusive, so that old bookings keep their intended months.
37. As a maintainer, I want the same compiler to run in Node and in the browser, so that the v2 live editor can reuse it unchanged.

## Implementation Decisions

- **Modules** (one deep module behind one interface, plus thin adapters):
  - *Dates*: parse point tokens at their own precision (day, month, quarter, ISO week, year), ranges with inclusive ends and relative ends, working days per month (Mon–Fri in v1).
  - *Parser*: tokenises lines (quoted titles, comments starting with `# ` or `//`, tags `#x`), classifies each line as person, project, calendar, role, capacity change, booking or task declaration, and reports syntax errors with file and line.
  - *Compiler* (the deep module): `compile(files: {path, text}[]) → { model, diagnostics }`. It merges statements, builds the work tree with inheritance and roll-up, resolves relative `after:` references, computes effective windows, spreads demand and supply per month and runs all lint rules. It is pure: no file system and no clock.
  - *Views*: pure functions of the model that produce load per person and month, role balance per root and month, and tree rows; shared by the HTML and spreadsheet adapters.
  - *Adapters*: CLI (`lint`, `report`, `xlsx`), HTML renderer (a static page with inline CSS and a small filter script), spreadsheet writer, legacy importer.
- **Line kinds** (decision-rich shape; it comes from the design session):
  ```
  calendar CH 8h/d 164h/m
  person  @id "Name" cap:80% role:POW,SYS loc:CH
  project +ROOT "Title" 2024-01..2024-12 #tag loc:CH role:POW ~1000h
  +ROOT.node.task "Title" ~540h ?HW:60% ?PCB:40% after:.sibling left:200h !1 2024-03..
  @id +ROOT[.node…] 50% 2024-01..2024-03 [status:requested|confirmed|unspecified]
  @id cap:50% 2024-07..2024-12        # capacity change
  ```
- **Inherited defaults**: tags combine from ancestors to descendants without duplicates. `role:HW,SYS` sets default roles on a project or node. A node's explicit `?roles` replaces the inherited role list. `loc:CH` selects its effort calendar. An explicit role list or `loc:` overrides the inherited default. Implicit nodes pass defaults onward.
- **Effort units**: `h` is hours. `d` and `pm` use the node's inherited calendar hours per day and month, including for `left:`. Defaults are 8 h/day and 164 h/month, with `defaultHpm` available to compiler callers. Person calendars determine booking hours independently. Calendar hour factors must be positive and finite. Project budgets use the same effort units; duplicate root budgets produce E005.
- **Booking status**: confirmed if the file lives under `teams/`, requested if under `projects/`, unspecified elsewhere. An explicit valid `status:` wins. Unknown values produce E001. Forecast supply includes all active states (ADRs 0007 and 0010).
- **Confirmation matching**: match person, path, percentage, and resolved inclusive dates. Each confirmed line replaces one exact request. Match equal candidates by source path and line for file-order independence. Partial matches and extra duplicates remain active. Replaced requests produce I202 and remain in source files. Active requests produce I201. Calculated bookings and spreadsheet booking rows contain active lines only.
- **Supply per role**: a person's hours credit their primary role only (open question in the design map).
- **Capacity changes**: overrides replace the baseline on their working days. Overlapping override ranges for one person are E008 errors. Conflicted days use the lowest override, independent of file order. W101 and W102 use effective capacity, including temporary changes. W102 requires a positive booking on a working day with zero capacity.
- **Pool/pin rule** (ADRs 0003 and 0009): group each person's active bookings by path for each month. A pin consumes the nearest booked ancestor. Each group uses the greater of its own hours and the sum of its immediate children's effective hours. Apply this rule recursively. W105 identifies the pool whose immediate children exceed its hours. Top-level effective hours count once toward load and primary-role supply. Same-path bookings add before nesting.
- **Status attribution**: pins retain their own states. Subtract their effective hours from the pool before attributing its residual hours. Split a same-path pool's residual among its lines in proportion to their own hours. Confirmed, requested, and unspecified totals sum to the forecast load. HTML tooltips and spreadsheet Hours show all three totals.
- **Demand validation**: explicit role shares cannot exceed 100% in total. Unweighted roles split the remainder equally. If all roles have shares, their sum must be 100%, within a numerical tolerance of 0.0000001 percentage points. Completion must be between 0% and 100%. Invalid shares or completion produce E001. Effort and percentages must be finite. `left:` overrides the demand derived from `done:`. Positive effort without working days after `--as-of` produces W110 and stays in the remaining-effort roll-up.
- **Effective windows**: intersect each node's dates with every inherited bound, including bounds on open-ended parents. Apply predecessor end dates afterward. W106 identifies dates outside the parent, empty intersections, and blocked dependencies. An empty parent blocks all descendants. An empty predecessor, or one without an end date, blocks its successors. Blocked tasks retain their effort totals but create no demand. Dates never extend automatically.
- **Lint codes**: E001 syntax or invalid demand/calendar/status values, E002 unknown root (with suggestion), E003 unknown person or calendar, E004 bad date or range, E005 duplicate declaration or root budget, E006 unresolved `after:`, E007 dependency cycle, E008 overlapping capacity changes; W101 overload (one per person), W102 booking on effective zero capacity, W103 path referenced by a booking but never declared (the typo case), W104 role shortfall (one per root and role), W105 pins exceed pool, W106 child window outside parent or blocked by parent/predecessor constraints, W108 effort without a window (one per root), W109 children's effort above the parent's budget, W110 positive effort without remaining working days; I201 active requested booking, I202 request replaced by an exact confirmation.
- **Unknown roots**: a booking on an undeclared root is an error, but its hours still count in the person's load, so overloads are never hidden by a typo.
- **No build step**: only TypeScript syntax that Node 22.18+ strips natively (no enums, namespaces or parameter properties); relative imports end in `.ts` (ADR 0008).
- **Dependencies**: one runtime library for writing and reading spreadsheets; nothing else.

## Testing Decisions

- A good test feeds plan text into `compile` and asserts on diagnostics or on view numbers; it never inspects internal structures, so the internals can be rewritten freely.
- One seam: `compile` plus the view functions. The CLI gets a single smoke test that runs it on a fixture folder and checks the exit code and that the files it writes exist.
- Covered behaviour: date parsing (precisions, inclusive ends, invalid dates, relative ends, ISO weeks), every lint code with a minimal fixture, inheritance and roll-up, uniform spread over partial months, pool/pin arithmetic, booking status by folder, and the legacy importer's date rule.
- Test runner: Node's built-in `node:test` with synthetic fixtures under `test/fixtures`; no real planning data in the repo.

## Out of Scope

- Automatic leveling (`pbt level`), gantt export, baseline diff and actuals import (v1.x).
- The live split-pane editor (v2).
- Holidays and per-person calendars beyond hours per month.
- Cost and rates.
- Any server, database or user management.

## Further Notes

- Design decisions and their reasons: `docs/adr/0001`–`0010`; vocabulary: `CONTEXT.md`; design map with open questions: `.scratch/pbt-design/map.md`.
- The real legacy data stays outside the repo. Running the importer on it is expected to report several overbookings above 100% (up to 400%), undeclared roots and one invalid date.
