# 05: Pools, pins and booking status

**What to build:** A booking below another booking of the same person consumes the parent's hours instead of adding to them; bookings in `projects/` are requested, in `teams/` confirmed, explicit `status:` wins; the report marks requested bookings.

**Blocked by:** 02

**Status:** done (booking-status regressions verified)

- [x] Load uses max(pool, sum of immediate pins' effective hours), recursively per month
- [x] W105 identifies each pool whose immediate pins exceed its hours
- [x] Nested and sibling pins count once toward load and role supply
- [x] Same-path pool bookings add before pins consume them
- [x] I201 identifies each active request; I202 identifies requests replaced by exact confirmations
- [x] Pins retain their status; the pool's residual hours retain their original status
- [x] Heatmap tooltips separate confirmed, requested, and unspecified hours
- [x] All active hours count as forecast supply, including requests and unspecified bookings
- [x] Each confirmation replaces one request with the same person, path, percentage, and resolved dates
- [x] Matching is independent of file order; partial matches and unmatched duplicates stay active
- [x] Invalid explicit status values produce E001
- [x] Spreadsheet Hours includes each status total; Bookings contains active lines only

## Comments

- 2026-11-06: implemented in the first prototype commit; tests in `test/`. Review the breakdown and reopen or split if needed.
- 2026-11-06: recursive pin regressions pass. A 100% pool with a 60% package pin and a 60% task pin stays at 100%. Requested/confirmed attribution beneath pools still needs correction. Request-to-confirmation matching and whether requests count as committed supply still need a decision.
- 2026-11-06: user selected forecast supply from all booking states, with exact confirmations replacing requests. Tests in `test/inheritance-status.test.ts` and `test/status-export.test.ts` cover nested statuses, exact matching, overflow, file order, and exported totals. Source lines remain unchanged.
