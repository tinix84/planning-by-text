# Agent guide

Planning by Text: a plain-text language and TypeScript tool for resource planning (demand per role vs supply per person). Read `CONTEXT.md` for vocabulary and `docs/adr/` before changing behaviour.

## Commands

- `node src/cli.ts lint <dir>`: parse and lint a plan folder
- `node src/cli.ts report <dir> -o plan.html`: self-contained HTML report
- `node src/cli.ts xlsx <dir> -o plan.xlsx`: spreadsheet export
- `node --test`: run tests (Node 22.18+, no build step: only erasable TypeScript syntax, imports end in `.ts`)

## Rules

- Never commit real planning data (names, allocations). `legacy/` and `data/` are git-ignored; tests use synthetic fixtures.

## Agent skills

- Issue tracker: local markdown, see `docs/agents/issue-tracker.md`
- Triage labels: `docs/agents/triage-labels.md`
- Domain docs: `docs/agents/domain.md`
- Design map: `.scratch/pbt-design/map.md`; v1 spec and tickets: `.scratch/pbt-v1/`
