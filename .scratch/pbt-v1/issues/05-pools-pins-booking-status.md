# 05: Pools, pins and booking status

**What to build:** A booking below another booking of the same person consumes the parent's hours instead of adding to them; bookings in `projects/` are requested, in `teams/` confirmed, explicit `status:` wins; the report marks requested bookings.

**Blocked by:** 02

**Status:** needs-triage

- [ ] Load uses max(pool, sum of pins) per month; W105 when pins exceed pool
- [ ] I201 for each requested booking
- [ ] Heatmap tooltip separates confirmed and requested hours
