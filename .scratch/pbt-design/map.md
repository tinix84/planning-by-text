# Map: Planning by Text

Label: wayfinder:map

## Destination

A specification of the planning-by-text language and its v1 tool (lint, HTML report, spreadsheet export, legacy importer), clear enough to hand to an implementing agent: the spec in `.scratch/pbt-v1/spec.md` and its tickets in `.scratch/pbt-v1/issues/`.

## Notes

- Domain: resource planning in a matrix engineering organisation (power electronics R&D); vocabulary in `CONTEXT.md`, decisions in `docs/adr/`.
- Skills to consult: grilling + domain-modeling for decision tickets; prototype for the live editor; research for the leveling algorithm.
- Tracker: local markdown (see `docs/agents/issue-tracker.md`); move to GitHub issues once the session has write access.
- Real planning data (people, allocations) never goes into the repo; tests use synthetic fixtures.

## Decisions so far

- [Planning model: allocation, leveling, or both?](issues/01-planning-model.md): both; demand is effort, the tool proposes, people pin.
- [How do bookings attach to work?](issues/02-addressing.md): dotted paths; pools and non-additive pins.
- [Which nodes must be declared?](issues/03-declaration.md): roots declared, children on first use.
- [Who writes which lines, in which files?](issues/04-files-ownership.md): free layout, registry/projects/teams template, status by folder.
- [Inclusive or half-open date ranges?](issues/05-date-ranges.md): inclusive at the precision written, ISO only.
- [How much does the tool schedule on its own?](issues/06-scheduling.md): uniform spread; leveling only suggests.
- [Baselines and actuals](issues/07-plan-vs-reality.md): git tags; imported actuals; remaining effort per task.
- [Which outputs, in which order?](issues/08-outputs.md): lint + HTML + xlsx, then gantt/diff, then live editor.
- [Which language for the shared core?](issues/09-core-language.md): TypeScript, one core, no build step.

## Not yet specified

- Approval workflow for requested bookings beyond the folder convention (who is notified, how a request becomes confirmed).
- Access control when plan files hold salary-adjacent data (rates, cost per hour) if cost views are added.
- Multi-plan aggregation across departments or sites (one repo per site or one shared registry).

## Out of scope

- Time tracking / timesheet entry (ADR 0006: actuals are imported).
- Task tracking at ticket granularity (status workflows, comments): Jira keeps that role.
