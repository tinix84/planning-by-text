# 16: Expand person projects into monthly task bookings

Status: done

## Acceptance criteria

- [x] Expand projects beneath a person to show that person's booked descendant paths and titles.
- [x] Align task hours with the existing month columns.
- [x] Use effective hours and label residual project and section pools without counting pins twice.
- [x] Do not infer task assignments from project pools or other people's bookings.
- [x] Mark projects without task bookings explicitly.
- [x] Preserve independent expansion, remembered state, filters, and keyboard access.
- [x] Preserve planning data, calculations, and prior reports.

## Comments

- 2026-11-08: The user requests expandable projects under each person, with monthly task hours where task bookings exist.
- 2026-11-08: All 192 tests pass. Edge checks confirm aligned task hours, pool reconciliation, independent people and projects, keyboard access, remembered state, and filters. Browser checks report no errors or external requests. All 71 pre-existing private files and outputs are SHA-256-identical. Diagnostics are unchanged. The real scenario has no descendant task bookings; a separate synthetic demo verifies the new controls without adding assignments.
