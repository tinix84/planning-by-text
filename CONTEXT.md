# Planning by Text

Plain-text resource planning for a matrix organisation: project managers write the **demand** for work, line managers write the **supply** of people, and the tool reconciles the two per role and per month.

## Language

### Structure

**Plan**:
The set of all plan files under one root folder, merged into a single model. Line order carries no meaning. File placement supplies the default booking status.
_Avoid_: project file, schedule

**Root**:
A top-level node of the work tree (a customer project, a technology programme, an internal activity), declared once in the registry.
_Avoid_: project (when the tree level matters), program

**Node**:
Any element of the work tree, addressed by a dotted **path** such as `OBC7.NACS.flt_test`; a root is a node with no parent.
_Avoid_: item, element, WBS entry

**Task**:
A leaf node that carries demand.
_Avoid_: ticket, issue, activity

**Registry**:
The declarations of roots, people, roles and calendars that every other line refers to.
_Avoid_: master data, config

**Window**:
The date interval in which a node's work may happen; inherited from the parent unless narrowed.
_Avoid_: duration, timeframe

### Demand

**Demand**:
Hours of work a task needs from a role, spread over the task's window.
_Avoid_: requirement, need, request

**Effort**:
The total hours a task needs, as estimated up front.
_Avoid_: work, cost, estimate (alone)

**Remaining effort**:
The hours a task still needs from now on, as judged by the people doing it; replaces effort in the computation once set.
_Avoid_: ETC, to-go, backlog

**Role**:
A kind of skill that supplies or demands hours (POW, DSP, CONN.SW); people have a primary role and optional secondary roles.
_Avoid_: function, discipline, competence

### Supply

**Person**:
An individual whose time can be booked; identified by an id, not by name.
_Avoid_: resource, FTE, employee

**Capacity**:
The share of full time a person is available for planned work, possibly varying over time.
_Avoid_: availability, utilisation

**Calendar**:
The conversion from percentages to hours for a location (hours per day, hours per month).
_Avoid_: shift, working-time model

**Booking**:
A statement that a person spends a share of their time on a node within a window.
_Avoid_: allocation, assignment, reservation

**Pool**:
A booking on a non-leaf node: hours that any task beneath it may draw on.
_Avoid_: budget (that is effort on a parent)

**Pin**:
A booking beneath a pool of the same person; it consumes the pool's hours and never adds to them.
_Avoid_: sub-allocation, override

**Requested booking**:
A booking written by the demand side, not yet agreed by the person's line manager.
_Avoid_: tentative, soft booking

**Confirmed booking**:
A booking written by the supply side.
_Avoid_: hard booking, committed

**Unspecified booking**:
A booking without a stated request or confirmation state.

**Forecast supply**:
Hours represented by confirmed, requested, and unspecified bookings after exact confirmations replace matching requests.

**Load**:
A person's booked hours in a month divided by their capacity hours in that month.
_Avoid_: utilisation, occupation

### Reality

**Baseline**:
A frozen version of the plan used as the reference for variance.
_Avoid_: snapshot, version

**Actuals**:
Hours really spent, imported from the system of record; never typed into the plan.
_Avoid_: bookings (those are planned), timesheet

**Variance**:
Actuals plus remaining effort, minus baseline effort.
_Avoid_: deviation, overrun

**Suggestion**:
A line the tool proposes (a booking or a narrower window) that only enters the plan when a person pastes it.
_Avoid_: auto-schedule, leveling result
