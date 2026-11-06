# 05: Pools, pins and booking status

**What to build:** A booking below another booking of the same person consumes the parent's hours instead of adding to them; bookings in `projects/` are requested, in `teams/` confirmed, explicit `status:` wins; the report marks requested bookings.

**Blocked by:** 02

**Status:** ready-for-agent (remaining booking-status work)

- [x] Load uses max(pool, sum of immediate pins' effective hours), recursively per month
- [x] W105 identifies each pool whose immediate pins exceed its hours
- [x] Nested and sibling pins count once toward load and role supply
- [x] Same-path pool bookings add before pins consume them
- [x] I201 for each requested booking
- [ ] Heatmap tooltip separates confirmed and requested hours

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: recursive pin regressions pass. A 100% pool with a 60% package pin and a 60% task pin stays at 100%. Requested/confirmed attribution beneath pools still needs correction. Request-to-confirmation matching and whether requests count as committed supply still need a decision.
