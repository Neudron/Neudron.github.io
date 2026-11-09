# Work order V3-201/202 — ice mouse and torch puzzles

**Base:** after V3-200. **Owner:** Opus visible art/controller; Sonnet isolated solver and state tables. **Allowed:** `js/act4/rooms-a.js`, `js/act4/look-castle.js`, new test fixtures and cleared assets. **Forbidden:** boss, unrelated room transitions, save schema downgrade. **Depends:** complete grid specification approved first.

**B4 mouse:** old 20×12 slide-ring has 4 plates and `solved:b4_ice` flag. Produce exact grid, cheese goal, mouse move controls/behavior, obstacles and 3-stage deduction sequence, unique or bounded solution proof, error recovery/reset. Visually show mouse *beneath* translucent ice and different shadow, not on same player plane. Gate opens after mouse touches/nibbles/celebrates.

**B6 torch:** old 20×12 has torch (2,6), socket (10,6), gate (19,6), `solved:b6_dark`. Keep torch mechanic; add controllable light direction and mirror/shadow/clue inference; author wrong states, reset and complete solver trace. Do not fake challenge by reducing visibility.

Write explicit scene state machine, exact controls and screenshot timeline before implementation. Tests must prove solvability, reset, save/reload, no accidental softlock, no lost item, mobile and reduced motion. **Rollback:** old implementation is preserved in base branch for comparison.
