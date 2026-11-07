# 14: Display load units and booking hours

Status: done

## Acceptance criteria

- [x] Monthly load cells show the percent sign.
- [x] Each booking shows its hours beside its path in person and project details.
- [x] Use the existing calendar-aware booking hours and identify the full booking date range.
- [x] Retain the explanation that pins consume their pool.
- [x] Verify the report and preserve all existing planning data and outputs.

## Comments

- 2026-11-07: The user reports missing percent signs and hours beside booking paths. The user also requests an in-app browser preview for annotation.
- 2026-11-07: All 187 tests pass. Local Edge checks confirm percent signs and booking hours, unchanged diagnostics, no browser errors, and no external requests. All 61 pre-existing private files under the data, output, and Claude-output folders remain SHA-256-identical. The local preview was queued in the app browser panel.
