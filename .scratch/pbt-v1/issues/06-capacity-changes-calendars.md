# 06: Capacity changes and location calendars

**What to build:** `calendar CH 8h/d 164h/m` and `loc:` change hours per month per person; `@id cap:50% 2024-07..2024-12` overrides capacity for a window; load and supply use them.

**Blocked by:** 01

**Status:** done (capacity regressions verified)

- [x] Two calendars give different booking hours for the same %
- [x] Capacity override applies only inside its window, including partial months
- [x] Overlapping override ranges produce E008 with a source location
- [x] Conflicted working days use the lowest override, independent of file order
- [x] Adjacent overrides count each working day once
- [x] W101 uses effective capacity even when the declared baseline is zero
- [x] W102 checks positive bookings against effective zero-capacity working days
- [x] Unknown calendar id is E003-style error

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: capacity regressions pass in `test/calculation-regressions.test.ts`. Overlapping overrides fail lint instead of adding capacity. Reports use the lowest conflicting override so file order cannot inflate availability. Effective-capacity warnings cover returns from leave and temporary zero capacity.
