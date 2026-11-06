# Plain text files are the single source of truth

The plan lives only in declarative, line-oriented text files in git; every view (lint, heatmap, report, spreadsheet, the future live editor) is derived from them and nothing is stored elsewhere. We chose this over a database-backed tool (Jira, MS Project, a web app) because git gives history, review, blame and baselines for free, and because terse text is faster to write than forms. Line order and file placement carry no meaning, so one file can later be split by owner without rewriting anything.

## Consequences

- The live editor (v2) edits the files themselves; it never introduces a database.
- Anything that cannot be expressed as a line (comments, approvals) lives in git, not in the tool.
