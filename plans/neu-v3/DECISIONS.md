# Architecture and creative decisions — evidence ledger

| ID | Decision | Basis | Revisit when |
| --- | --- | --- | --- |
| D01 | Retain current ES5 Canvas/NEU pipeline for the first vertical slice | Fixed-step and swept movement already exist; no measured proof of a renderer bottleneck | Profiler shows recurring CPU/GPU frame budget failures |
| D02 | Preserve `go/land` as explicit fallback; add opt-in seam transition | Current world gates and saves depend on room IDs and spawns | All seam and return-path tests green |
| D03 | Keep game modes' distinct physics with shared input ownership | Current code includes platformer, rhythm and cards | Shared ownership tests pass |
| D04 | Use existing `neu.save.v1` key and migrate in versioned steps | Current `save.js` is at schema v3 | New fields are stable and old saves tested |
| D05 | Do not bypass the post-boss story Console gate | Attached V3 specification explicitly forbids conflating story/launcher/dev console | Private canon confirms progression adjustment |
| D06 | Do not lift franchise assets into new content without license evidence | Existing folders are not proof of a redistribution grant | Rights holder authorizes |
| D07 | Scene timing values are playtest targets, not hard requirements | Browser/gamefeel results needed | Input timing review |
| D08 | Public review docs avoid dumping the original private walkthrough; local-only notes remain the canon source | Public repository/hidden-game context | User explicitly approves sharing detailed walkthrough |
| D09 | Run public CI with tracked npm pipeline, local full jsdom suite only where installed | GitHub tree lacks most tests and runner | Full test harness made accessible |
| D10 | Opus owns rendered and visible changes; bounded nonvisual work delegated | User's requested role separation | Explicit user instruction |
