# 09: Named competency assessments and qualification profiles

Status: done

## What to build

Connect named people to competency assessments. Check optional qualification requirements on work nodes. Preserve the distinction between qualifications and planning roles.

## User decisions

- Use `Fähigkeitsmatrix_new` for the first import.
- Show minimum checks, competency gaps, unknown assessments, and overall coverage.
- Keep planning roles separate. Add optional qualification profile requirements.

## Acceptance criteria

- [x] Parse competency definitions, profiles, and named-person assessments with levels 0 through 4.
- [x] Reject malformed IDs, invalid levels, duplicates, and unknown references with source locations.
- [x] Support inherited `profile:` defaults and explicit child replacement.
- [x] Warn separately about below-minimum levels, unknown assessments, and inactive people on direct bookings.
- [x] Preserve all demand, supply, capacity, pool/pin, and confirmation calculations.
- [x] Match candidates by requirements met. Keep unknowns in the denominator and exclude inactive candidates by default.
- [x] Import the clean competency header, ROLE requirement rows, and assessed people from the selected sheet.
- [x] Match unique normalized full names. Support explicit aliases. Keep unresolved identities unassessed.
- [x] Generate missing planning role declarations from existing references without editing existing files.
- [x] Refuse output overwrites. Preserve workbook and existing plan files.
- [x] Verify synthetic import-to-lint-to-match behavior and regression cases.

## Comments

- 2026-11-06: The user clarified that a competency matrix supplies profile requirements and named assessments. A manual role registry alone does not meet this need.
- 2026-11-06: All 174 tests pass. New regressions cover compiler checks, matching coverage, inherited requirements, exact confirmation replacement, ambiguous identities, explicit aliases, invalid levels, header collisions, source preservation, overwrite protection, CLI matching, and report/export profile columns. Existing private data remains unchanged.
