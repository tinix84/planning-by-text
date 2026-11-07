# planning-by-text

Resource planning as plain text. Project managers write **demand** (effort per role), line managers write **supply** (people, capacity, bookings), and `pbt` reconciles the two per role and per month: lint, a self-contained HTML report, and a spreadsheet export.

```
# registry.pbt
calendar CH 8h/d 164h/m
role POW "Power electronics"
role DSP "Digital signal processing"
person  @alice "Alice Example" cap:100% role:POW loc:CH
project +ALPHA "Alpha charger" 2024-01..2024-06

# projects/ALPHA.pbt  (demand, written by the PM)
+ALPHA.pfc.design "PFC design" ~328h ?POW 2024-01..2024-02
+ALPHA.pfc.test   "PFC test"   ~164h ?POW:50% ?DSP:50% after:.design
@bob +ALPHA.pfc.test 50%                       # a booking here = requested

# teams/POW.pbt  (supply, written by the line manager)
@alice +ALPHA 100% 2024-01..2024-03            # pool on the project
@alice +ALPHA.pfc.design 120% 2024-02          # pin: consumes the pool, never adds
@alice cap:50% 2024-07..2024-12                # part-time from July
```

| Sigil | Meaning | | Sigil | Meaning |
|---|---|---|---|---|
| `@` | person | | `~` | effort (`h`, `d`, `pm`) |
| `+` | work path `ROOT.node.task` | | `%` | load / capacity |
| `?` | role demand (`?HW:60%`) | | `..` | date range, inclusive at written precision |
| `#tag` | tag | | `"…"` | human title |
| `after:` `left:` `done:` `status:` `!1` | attributes | | `# ` / `//` | comment |

Dates: `2024-03`, `2024-Q2`, `2024-W10`, `2024-03-15`, `2024-03..+3m`. ISO only; impossible dates are errors.

Week 53 must exist in the named ISO year. For example, `2020-W53` is valid and `2021-W53` is an error. Ranges accept one `..` separator and at least one endpoint. Relative durations must be positive integers with an explicit start and a representable end date.

Declare every referenced planning role once, for example `role CONN.SW "Connection software"`. Role IDs are case-sensitive. `role:CONN.SW` and `?CONN.SW` require that exact declaration. Forward declarations and declarations in separate files are valid. Importers can generate these declarations from existing references. Review generated IDs for spelling errors.

## Competencies and qualification profiles

Planning roles group hours. Qualification profiles define minimum competency levels. A person can match several profiles while supplying each booking's hours once.

```text
competency CIRCUITS "Circuit design"
competency REVIEW "Design review"
profile Senior_HW "Senior hardware" CIRCUITS:3 REVIEW:2
assessment @alice active:true CIRCUITS:4 REVIEW:1
+ALPHA.pfc.design ~328h ?POW profile:Senior_HW
```

Levels are integers from 0 through 4. Positive profile levels are requirements. Assessment zero or an absent value means not assessed. Profile zero means not required.

`profile:` is optional on work nodes. Children inherit it through implicit parents. An explicit child profile replaces the inherited profile. It is independent of `?POW` and `role:POW`.

Direct bookings produce W111 for below-minimum levels, W112 for unknown assessments, and W113 for an inactive assessment. These checks retain booking hours. A pool does not imply that its person performs every descendant task.

```sh
node src/cli.ts match data/plan --profile Senior_HW
node src/cli.ts match data/plan --task ALPHA.pfc.design
node src/cli.ts match data/plan --profile Senior_HW --include-inactive
```

Matching prints JSON with one result per person and one check per positive requirement: `meets`, `below`, or `unknown`. Coverage is requirements met divided by positive requirements. Unknown assessments remain in the denominator. Empty profiles have no coverage value. Results sort by coverage, then person ID. Inactive people are excluded by default. People without an assessment remain visible with unknown levels. Matching checks qualifications and does not assign bookings or calculate available capacity.

Import a competency workbook into a new private snapshot:

```sh
node tools/import-competencies.ts data/source/matrix.xlsx data/plan -o data/plan/competencies.pbt --aliases data/aliases.json
```

The importer reads only `Fähigkeitsmatrix_new`. It uses the `Name`/`active` header row for competency names, `ROLE` rows for minimum levels, and assessed rows for people. Header whitespace is normalized. Expert annotations in the top summary row are excluded. Competency and profile IDs use sanitized labels. Empty or colliding IDs, invalid levels, and invalid active flags stop the import.

People must already have plan IDs. A unique normalized full-name match links an assessment to that ID. Unmatched or ambiguous names remain unassessed. Optional aliases use an exact matrix name, for example `{"bob":"Robert Example"}`. Duplicate matrix names and one matrix row linked to multiple plan IDs require correction before import. Matrix-only people are not added to the plan automatically.

The importer creates missing planning role declarations from existing references. It retains pre-existing date errors for lint and reports their count. It writes one new file and refuses overwrites. The workbook and existing plan files remain unchanged. On refresh, import against the original plan inputs without the previous snapshot, and review the new snapshot before replacing the selected input. Keep real snapshots and aliases under ignored `data/` or `legacy/`.

## Defaults and booking status

Set node defaults with `loc:` and `role:`. Children inherit them through implicit nodes. Tags combine without duplicates. Explicit child roles or `loc:` replace the corresponding default.

```
calendar DE 6h/d 150h/m
project +ALPHA "Alpha charger" 2024-01..2024-06 loc:CH role:POW ~1000h
+ALPHA.group loc:DE ?DSP #lab
+ALPHA.group.task ~1pm left:2d
```

Task effort and `left:` use the node calendar for days and person-months. Without a selected calendar, defaults are 8 h/day and 164 h/month. Declare each selected calendar in the registry. Booking hours use the person's calendar.

All active bookings count as forecast supply. The report separates confirmed, requested, and unspecified hours. Pins retain their status while consuming their pool. Spreadsheet Hours includes the same status totals.

To confirm a request, add the same booking under `teams/` or use `status:confirmed`. Each confirmation replaces one request with identical person, path, percentage, and resolved dates. Partial matches stay separate. I202 identifies the replaced request. Source files retain both lines, while calculated views count the active confirmation once.

## Usage

In the HTML report, click a person's name to expand their bookings and work paths. Click a project in the project balance, or **Resources** beneath a work-tree root, to see its booked people. Each entry shows the percentage, resolved dates, booking status, and pool/pin context. Expanders also work with the keyboard. Project pools retain unspecified task assignments. Scenario reports can display an explicit list of unverified assumptions.

The demand/supply table shows one total row per project. Click **Roles** to expand the monthly role breakdown. Red project cells retain individual role-shortfall signals, including when the total supply covers the total demand. The text filter also matches collapsed roles.

The work tree starts with roots only. Click a root or section name to show its immediate children. **Expand all** opens every branch. **Collapse all** returns to the project overview. Both controls respect the current filter. A counter shows the visible work items. Each branch has its own expansion state. Search reveals matching paths and their ancestors. Clearing search restores normal expansion choices. Resource dropdowns remain independent of tree expansion.

Expanding a project in the balance table shows its booked people and work breakdown, including titles, effort, remaining effort, roles, and dates. Projects without bookings are explicitly unassigned. Projects without task records say so. The work tree shows remaining effort even when it equals the estimate. Missing estimates are labeled **Not estimated**. Explicit zero estimates remain zero.

Requires Node 22.18+ (TypeScript runs natively, no build step).

```sh
npm install
node src/cli.ts lint   test/fixtures/basic            # exit 1 on errors
node src/cli.ts report test/fixtures/basic -o plan.html
node src/cli.ts xlsx   test/fixtures/basic -o plan.xlsx
npm test
```

Migrating legacy data (`resources.md` allocation list + effort spreadsheet):

```sh
node tools/import-legacy.ts resources.md effort.xlsx -o data/plan [--root OBC7B] [--window 2025-01..2025-12]
node src/cli.ts lint data/plan
```

The importer keeps legacy mistakes (typos, impossible dates, unknown projects) so the first lint shows them. Keep real planning data in `data/` or `legacy/`: both are git-ignored.

New spreadsheet imports include one declaration per referenced role. This does not rewrite existing imported files.

## Lint codes

| Code | Meaning |
|---|---|
| E001 | syntax error or invalid demand, calendar hours, booking status, or role identifier |
| E002 | unknown root (with "did you mean") |
| E003 | unknown person, calendar, role, competency, or qualification profile |
| E004 | impossible date/week, malformed or reversed range, invalid duration, booking without dates |
| E005 | duplicate declaration or root budget |
| E006 / E007 | `after:` target missing / dependency cycle |
| E008 | overlapping capacity changes for one person |
| W101 | person load above capacity (per person: months and peak) |
| W102 | positive booking on a working day with effective zero capacity |
| W103 | path used by a booking but never declared as a task |
| W104 | role demand above supply (per root and role) |
| W105 | pins exceed their pool |
| W106 | child window outside parent, or blocked by parent/predecessor constraints |
| W108 | effort without any window (per root) |
| W109 | children's effort above the parent's budget |
| W110 | positive effort without remaining working days |
| W111 | booked person below a qualification profile's minimum competency level |
| W112 | booked person lacks a required competency assessment |
| W113 | booked person's assessment marks them inactive |
| I201 | active requested booking |
| I202 | request replaced by an exact confirmation |

## Docs

- `CONTEXT.md`: vocabulary
- `docs/adr/`: design decisions and their reasons
- `.scratch/pbt-design/map.md`: design map, decisions and open questions
- `.scratch/pbt-v1/`: v1 spec and tickets
