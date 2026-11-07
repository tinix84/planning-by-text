# 11: Group role balances under one project row

Status: done

## Problem

The report renders a project label once per role. Projects with many roles appear duplicated even though the parser creates one root.

## Acceptance criteria

- [x] Show one project total row in the demand/supply table.
- [x] Keep the per-role monthly values in a collapsed Roles breakdown.
- [x] Retain the project-to-resources dropdown.
- [x] Retain role-shortfall coloring even when total supply covers total demand.
- [x] Preserve filtering, keyboard controls, and offline behavior.
- [x] Keep all model calculations and existing private files unchanged.
- [x] Verify synthetic multi-role cases and the affected private report in a browser.

## Comments

- 2026-11-07: The user confirms repeated project rows in the GUI. Parser and importer changes are outside this correction.
- 2026-11-07: All 180 tests pass. Edge verifies one project summary, collapsed roles, matching-role filtering, resource expansion, keyboard toggles, unchanged diagnostics, correct totals, and no external requests.
