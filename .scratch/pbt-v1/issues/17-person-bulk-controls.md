# 17: Bulk expansion for person, project, and task hours

Status: done

## Acceptance criteria

- [x] Expand all opens every person and each project with task bookings.
- [x] Collapse all closes every person and project in the monthly person view.
- [x] Preserve the active text filter.
- [x] Keep work-tree, project-balance, and assumption controls independent.
- [x] Keep individual controls usable after bulk actions, with matching arrows and accessible labels.
- [x] Verify mouse, keyboard, empty results, and monthly values.
- [x] Preserve all planning data, calculations, and previous reports.

## Comments

- 2026-11-08: The user requests bulk controls for the person/project/task view to see all monthly task hours at once.
- 2026-11-08: All 193 tests pass. Edge verifies bulk and individual controls, keyboard access, active filters, no matches, empty plans, and independent work-tree, role, and assumption controls. All 105 task-month cells match the model. Diagnostics are unchanged. All 96 pre-existing private files and outputs remain SHA-256-identical. A new GUI uses the existing example scenario without modifying it.
