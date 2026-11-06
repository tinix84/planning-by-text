# Demand and supply are written separately; the tool reconciles them

Project managers write tasks with effort per role (demand); line managers write people, capacity and bookings (supply). The tool compares the two per role and per month instead of asking anyone to write a fully resourced schedule. We picked this "effort + pins" model over pure allocation (a capacity spreadsheet, which cannot say what work is unstaffed) and over full automatic scheduling (which nobody can explain). It mirrors how the source data was really kept: a bottom-up effort sheet per role and a separate top-down allocation list per person.

## Considered Options

- Allocation only: simplest, but demand is invisible.
- Effort + automatic leveling as the truth (TaskJuggler style): realistic dates, but one edited line can move the whole plan.
