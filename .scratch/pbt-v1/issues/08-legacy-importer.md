# 08: Legacy importer

**What to build:** A one-off command converts the old allocation list (markdown bullets and the Mermaid-style line) and the effort spreadsheet into registry/teams/projects plan files, keeping legacy errors visible so the first lint shows them.

**Blocked by:** 03

**Status:** done (prototype)

- [ ] `from DD.MM.YYYY to 01.MM.YYYY` imported as exclusive (ends the previous month); other ends inclusive
- [ ] Invalid dates, typos in project names and duplicates are kept, not fixed
- [ ] Spreadsheet section headers become intermediate nodes; Who column becomes `?roles` (`CONN(SW,SYS)` → `?CONN.SW ?CONN.SYS`); simple formulas evaluated
- [ ] Output lints without E001

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
