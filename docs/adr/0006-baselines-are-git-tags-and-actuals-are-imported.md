# Baselines are git tags; actuals are imported, never typed

A baseline is a git tag (`baseline/OBC7-G2`), compared with `pbt diff`. Hours actually spent are imported read-only from the system of record into CSV; the plan carries only an optional remaining-effort judgement per task, and variance = actuals + remaining − baseline. We rejected typing timesheet lines into the plan: the files would grow without bound and engineers would not maintain two timesheets.
