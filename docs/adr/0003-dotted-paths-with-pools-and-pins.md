# Work is a dotted-path tree; bookings are pools, deeper bookings are pins

Every node is addressed like `class.member` (`+OBC7.NACS.flt_test`). A booking may target any depth: on a non-leaf node it is a pool for the subtree, and a booking of the same person deeper down is a pin that consumes the pool's hours rather than adding to them. Children inherit window, tags, calendar and default role; effort rolls up. Roots must be declared in the registry, children are created on first use. This keeps today's project-level bookings valid while making task-level precision opt-in; the non-additive pin rule is the surprising part and exists so the same hours are never counted twice.

## Inherited defaults

Clarified on 2026-11-06.

Children combine inherited tags with their own tags. An explicit role list or `loc:` replaces that inherited default. Implicit nodes pass these defaults to descendants.

Work has a location even before a person is assigned. Therefore, task effort uses the node's inherited location calendar. Booking hours use the person's calendar. This keeps estimates independent of later staffing choices.
