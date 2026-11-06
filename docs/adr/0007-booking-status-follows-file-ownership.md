# Booking status follows the folder that holds the line

A booking written under `projects/` (the demand side) is *requested*; under `teams/` (the supply side) it is *confirmed*; an explicit `status:` overrides. This encodes the matrix-organisation rule that line managers, not PMs, commit people, without adding a field everyone must type. It deliberately couples meaning to file location, which otherwise carries none (ADR 0001); the layout is a convention that lint can enforce per folder.
