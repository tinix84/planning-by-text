# 02: HTML report with load heatmap and lint list

**What to build:** `pbt report <dir> -o plan.html` writes one self-contained file (inline CSS and JS, light and dark) showing the diagnostics list and a person × month heatmap with hours on hover, plus a text filter.

**Blocked by:** 01

**Status:** done (prototype)

- [ ] Opens offline from disk, no external requests
- [ ] Cells coloured by load bands (<80, 80–100, >100 %), ∞ for zero capacity
- [ ] Filter narrows people and diagnostics by substring
- [ ] Smoke test: file is written and contains every person id

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
