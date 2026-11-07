# 12: Collapsible work tree

Status: done

## What to build

Show roots initially. Let readers expand roots and sections to reveal their immediate children instead of displaying every task at once.

## Acceptance criteria

- [x] Start with roots visible and every descendant row collapsed.
- [x] Give each explicit or implicit branch an independent keyboard-accessible toggle.
- [x] Collapse all descendants when a parent closes. Remember nested expansion choices when it reopens.
- [x] Keep Resources separate from branch expansion.
- [x] Search reveals matching paths with ancestors. Clearing search restores normal expansion choices.
- [x] Preserve full paths, all row values, and all planning calculations.
- [x] Verify synthetic nesting and the affected private report without changing planning files.

## Comments

- 2026-11-07: Requested after grouping project-role balances. This change affects only report navigation.
- 2026-11-07: All 182 tests pass. Edge verifies initial roots, nested and implicit branches, parent collapse, remembered state, keyboard controls, independent resource dropdowns, search paths, and exact parent boundaries. Existing diagnostics remain unchanged. No external requests occur.
