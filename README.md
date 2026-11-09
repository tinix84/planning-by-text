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

Declare every referenced role once, for example `role CONN.SW "Connection software"`. Role IDs are case-sensitive. `role:CONN.SW` and `?CONN.SW` require that exact declaration. Forward declarations and declarations in separate files are valid. Existing plans without role declarations now report E003 until their registry contains the referenced roles.

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
| E003 | unknown person, calendar, or role |
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
| I201 | active requested booking |
| I202 | request replaced by an exact confirmation |

## Docs

- `CONTEXT.md`: vocabulary
- `docs/adr/`: design decisions and their reasons
- `.scratch/pbt-design/map.md`: design map, decisions and open questions
- `.scratch/pbt-v1/`: v1 spec and tickets
