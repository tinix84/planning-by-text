# 06: Capacity changes and location calendars

**What to build:** `calendar CH 8h/d 164h/m` and `loc:` change hours per month per person; `@id cap:50% 2024-07..2024-12` overrides capacity for a window; load and supply use them.

**Blocked by:** 01

**Status:** done (prototype)

- [ ] Two calendars give different booking hours for the same %
- [ ] Capacity override applies only inside its window
- [ ] Unknown calendar id is E003-style error

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
