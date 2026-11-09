# 15: Monthly project hours beneath expanded people

Status: done

## Acceptance criteria

- [x] Expanding a person shows one project row aligned with the report month columns.
- [x] Show hours for each month, with a dash when no hours are allocated.
- [x] Use effective load parts so pools and pins count each hour once.
- [x] Retain requested, confirmed, and unspecified status information.
- [x] Keep expansion independent per person and preserve filters and keyboard access.
- [x] Preserve existing planning data and generated reports.

## Comments

- 2026-11-08: The user requests monthly project hours below expanded people, in addition to booking totals.
- 2026-11-08: All 189 tests pass. Edge verifies 735 project-month values against the model, column alignment, independent expansion, keyboard access, and filter restoration. No browser errors or external requests. Diagnostics are unchanged. All 66 pre-existing private files and outputs are SHA-256-identical. A new local GUI preview is queued in the app.
