# 13: Work-tree bulk controls and expanded project information

Status: done

## What to build

Add Expand all and Collapse all controls to switch between project overview and task detail. Populate project expansion with the recorded work breakdown. Explain unassigned resources without inventing bookings.

## Acceptance criteria

- [x] Expand all opens every branch and Collapse all returns to roots, including with an active filter.
- [x] Bulk actions preserve the current filter and other report controls.
- [x] Show the number of visible work items.
- [x] Project expansion shows descendant titles, effort, remaining effort, roles, and windows.
- [x] Explain when no people are assigned or no task breakdown is recorded.
- [x] Keep resource controls separate from the work breakdown.
- [x] Show remaining effort even when it equals the estimate. Distinguish missing estimates from explicit zero.
- [x] Verify mouse and keyboard behavior, filters, and all expanded task information.
- [x] Preserve planning data and calculated results.

## Comments

- 2026-11-07: The user confirms both task details and Resources appear empty. This is a presentation change. Missing source assignments remain unassigned.
- 2026-11-07: Completed. All 185 tests pass. Local Edge checks verify bulk controls, filtered paths, keyboard access, visible task values, project work details, and independent resource and role controls. Diagnostics are unchanged. SHA-256 checks confirm that all 60 pre-existing private files and outputs are unchanged. No assignments were added.
