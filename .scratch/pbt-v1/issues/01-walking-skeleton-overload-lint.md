# 01: Walking skeleton: people, bookings, overload lint

**What to build:** A plan folder with person declarations and bookings on declared roots compiles; `pbt lint <dir>` prints file:line diagnostics and exits non-zero on errors. Covers ISO date ranges (inclusive at written precision, relative ends, invalid dates), the default 164 h/month calendar, partial-month working-day proration and per-person monthly load.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

- [ ] `person`, `project` (root only) and booking lines parse; unparseable lines give E001 with file and line
- [ ] E002 unknown root with a did-you-mean suggestion; E003 unknown person; E004 non-existent date or reversed range; E005 duplicate declaration
- [ ] W101 when monthly load exceeds capacity; W102 booking on a person with cap:0%
- [ ] `2024-01..2024-02`, `2024-Q2`, `2024-W10`, `..+3m` resolve as specified
- [ ] CLI exit code 1 on errors, 0 otherwise; tests through `compile` only
