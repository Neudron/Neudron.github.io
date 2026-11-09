# Confirmed source gaps vs unverified runtime bugs

A statement about source code below is not proof that a player can reproduce a bug.

| Key | Status | Evidence | Next |
| --- | --- | --- | --- |
| TRANS-01 | NEEDS REDESIGN | `engine.go` always starts iris fade, `land` resets velocity/camera | prototype opt-in forest seam, check both directions and save |
| CASTLE-01 | NEEDS REDESIGN | B1 witch dialogue updates `witch_met` before any visible projectile/door choreography | author spell state machine under Opus |
| CASTLE-02 | NEEDS REDESIGN | B1 second throne currently `npc` with lines only | sit/stand interaction with collision-safe anchor |
| PUZZLE-01 | NEEDS REDESIGN | B4 four slide-only plate ring, not mouse/cheese | design solver-proved state puzzle |
| PUZZLE-02 | NEEDS REDESIGN | B6 torch and central socket without multistep mirror/clue logic | author deliberate reasoning puzzle |
| W10 | UNVERIFIED | Latest commit reports crack sky and surface bed implementation | test code and visually compare; avoid rewrites |
| W08 | UNVERIFIED | Latest commit reports recall arrival to e6_room | test replay, save and one-use consumption |
| W12 | UNVERIFIED | Latest commit reports merchant FNF fixes | capture rhythm/soul and victory views |
| TESTS-01 | BLOCKED | Remote tree contains only 3 tracked tests; full local suite unavailable | use local workshop runner |
| ASSET-01 | BLOCKED | Existing named franchise image folders lack per-asset rights evidence in public repo | complete license audit |
| STORY-01 | BLOCKED | Local memory/canon files absent from remote | reconcile without publishing private storyline |

Record additional bugs only with reproducible steps, version, expected/actual, screenshot/trace, severity and test.
