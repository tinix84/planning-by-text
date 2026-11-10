# Issue tracker: GitHub

Issues and specs live in GitHub Issues in `tinix84/planning-by-text`.
Use the `gh` CLI from this repository.

## Operations

- Verify the target: `gh repo view --json nameWithOwner`.
- Create: `gh issue create --title "..." --body-file <file>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,labels`.
- Comment: `gh issue comment <number> --body-file <file>`.
- Apply labels: `gh issue edit <number> --add-label "<label>"`.
- Remove labels: `gh issue edit <number> --remove-label "<label>"`.
- Close: post the explanation, then run `gh issue close <number>`.

Use UTF-8 files with actual newlines for multiline bodies.
Read `triage-labels.md` before applying triage labels.

## Skill instructions

When a skill says to publish to the tracker, create a GitHub issue.
When a skill says to fetch a ticket, read the GitHub issue.

## Relationships and wayfinding

Use native GitHub sub-issues and issue dependencies when available.
With the installed CLI, use `gh api` for these relationships.

If unavailable, list children in the parent issue.
Add `Part of #<parent>` and `Blocked by: #<number>` to child bodies.
An issue is unblocked when all its blockers are closed.

For wayfinding, use one map issue with child tickets.
Use `wayfinder:map` and `wayfinder:<type>` labels.
Claim a ticket by assigning it to the driving developer.
Resolve it with an answer comment, close it, and update the map issue.

## Pull requests as a triage surface

PRs as a request surface: no.

## Existing local records

Existing `.scratch/` records remain available as historical context.
This setup does not migrate or delete them.
Record new issues, specs, and current status in GitHub Issues.
