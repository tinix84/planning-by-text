# planning-by-text

Resource planning as plain text. Project managers write **demand** (effort per role), line managers write **supply** (people, capacity, bookings), and `pbt` reconciles the two per role and per month: lint, a self-contained HTML report, and a spreadsheet export.

```
# registry.pbt
calendar CH 8h/d 164h/m
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

## Lint codes

| Code | Meaning |
|---|---|
| E001 | line cannot be parsed |
| E002 | unknown root (with "did you mean") |
| E003 | unknown person or calendar |
| E004 | impossible date, reversed range, booking without dates |
| E005 | duplicate declaration |
| E006 / E007 | `after:` target missing / dependency cycle |
| W101 | person load above capacity (per person: months and peak) |
| W102 | booking on a person with `cap:0%` |
| W103 | path used by a booking but never declared as a task |
| W104 | role demand above supply (per root and role) |
| W105 | pins exceed their pool |
| W106 | child window outside parent, or empty after `after:` |
| W108 | effort without any window (per root) |
| W109 | children's effort above the parent's budget |
| I201 | requested booking |

## Docs

- `CONTEXT.md`: vocabulary
- `docs/adr/`: design decisions and their reasons
- `.scratch/pbt-design/map.md`: design map, decisions and open questions
- `.scratch/pbt-v1/`: v1 spec and tickets
