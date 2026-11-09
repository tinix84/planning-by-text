# 10: Person and project dropdowns in the HTML report

Status: done

## What to build

Let a reader expand a person's name to see their bookings and work paths. Let a reader expand a project to see booked people.

## Acceptance criteria

- [x] Person names expand to show active bookings, work titles, percentages, dates, status, and pool/pin context.
- [x] Project names in role balances and root work-tree rows expand to show booked people and descendant bookings.
- [x] Exact path boundaries keep similarly named projects separate.
- [x] Unbooked people and projects show an explicit empty state.
- [x] Project pools do not imply individual task assignments.
- [x] Native keyboard-accessible controls work offline without external requests.
- [x] Optional scenario assumptions are visible, marked unverified, and escaped as text.
- [x] Synthetic regressions cover escaping, descendants, empty states, active confirmations, and requested pins.

## Comments

- 2026-11-07: The user requests dropdowns on person and project names while reviewing a separate warning-fix scenario. Private scenario files stay outside public Git.
- 2026-11-07: All 178 tests pass. A local Edge check verifies person and project expansion, keyboard toggles, filtering, the assumption banner, and zero external requests. Existing plan files remain unchanged.
