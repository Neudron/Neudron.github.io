# Level design policy

Every level contract must list: verified room ID, source file, player spawn tile/facing, full tile layout, exits and return spawns, gate flags, intended route, landmarks, interactables, hazard collision, recovery/reset, solvability proof, visual layers, camera target, sound, scripted movement and save changes.

1. **A teaching beat precedes a combined beat.** Demonstrate a hazard unpunished before requiring precision; give feedback for wrong but recoverable attempts.
2. **Each exit has physical logic.** Do not use a seamless scrolling connection between unrelated dimensions. A door is a door, a lift moves vertically and a crack is supernatural.
3. **No arbitrary dead end.** Locked geometry communicates its gate, and side areas offer a meaningful reaction without granting premature progression.
4. **Space before scenery.** Keep corridors collision-safe; do not place decorative props in puzzle-required tiles.
5. **Readability at a glance.** Map surface, safe ground, hazards, movable pieces and progression affordances to distinct materials/silhouettes.
6. **Return routes matter.** Test reverse traverse unless canonical one-way event explicitly says otherwise, and never strand an old save.
7. **Completion visibly changes the scene** and persists when appropriate; do not set victory flags before the physical win moment.
8. **Puzzles have authored wrong states and resets**, not just success screens. Store the solution trace as an executable test fixture once mechanic is final.

Initial forest and castle contracts are in `plans/neu-v3/SCENES.md`; not-yet-audited rooms remain UNVERIFIED.
