# Preserve declared planning constraints in calculated views

Date: 2026-11-06.

Conflicting capacity changes fail lint. Reports use the lowest override on conflicted dates instead of selecting the last line or adding the percentages. This preserves file-order independence and prevents conflicts from inflating availability.

Pins consume the nearest booked ancestor. Each ancestor compares its own hours with the effective hours of its immediate children. Summing all descendants counts the same reservation more than once.

Task windows intersect inherited bounds and start after each predecessor. An empty predecessor window or a missing predecessor end date blocks dependent work. This retains explicit deadlines instead of creating replacement dates.

Role shares preserve task effort, and completion stays between zero and 100%. Positive effort without remaining working days produces a warning. The plan retains remaining effort instead of extending dates or discarding the estimate.
