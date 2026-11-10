# Inspectable Celeste-format training room geometry — supplemental evidence

These notes examine **actual publicly readable room bounds, solid rectangles, spawn positions and entity coordinates** from the [Celeste Next Gym training fixture JSON](https://github.com/std-microblock/celeste-next-gym/blob/master/mods/CelesteGymTraining/Build/generated.fixture.json) (Git blob `e07c827853cccb2b45aa76a3e57d7d7a11e1c747`). The source has original, programmatically generated learning environments: it is **not** a Strawberry Jam or Spring Collab lobby, not a high-quality mod map and not an accepted substitute for inspecting 20 community maps. No tiles or full JSON files were copied into our repository.

## Three room-level measurements

| Original training room | Actual bounds | Collision / entity evidence | Structural interpretation |
| --- | --- | --- | --- |
| `hyper-route` | 960×272 px | Spawn 32 px from room's left and on floor level 240; main floor has an early 32 px separation; upward spike strip covers 64 px farther into the route | First horizontal momentum transfer can be introduced with a gap before the late precision hazard. Gap and hazard challenge remain separate stages of the same traverse. |
| `hyper-spikes` | 480×272 px | Floor runs continuously across the 480 px room; the documented upward spike strip is 80 px wide at x=174; spawn at 32 px on floor | This isolates horizontal speed-to-height control without requiring platform-gap routing. |
| `hyper-bubble` | 480×272 px | Floor runs across the room; a 16×16 px booster entity is near the spawn at x≈104–120 (global map coords); no spike entity in the published record | A new interaction can be taught with a single deliberately safe object before using it near hazards. |

Coordinates and lengths are measured directly from the cited fixture; every room's successful traversal frames, required input sequence, timing tolerances, dash conservation, checkpoints and alternatives are **unknown**. A real map data dump cannot itself establish a solution.

## Reusable design ideas

1. **One new mechanic per early challenge.** Separate first-contact interaction (bubble) from precision consequence (spikes).
2. **Readable sequencing.** In `hyper-route`, geometry places a gap before later hazards, giving a meaningful first-then-next progression rather than random simultaneous traps.
3. **Safety and failure recovery are spatial.** Broad continuous ground in `hyper-spikes` and `hyper-bubble` separates learning the input from reset complexity.
4. **Scale is tied to movement.** The widths are test data, not portable universal numbers. Neudron doubles Celeste movement units for 16 px tiles; any distances must be authored against the Neudron controller and proven by a replay.

## Mapping candidates into original mountain designs

| Evidence | Candidate original mountain room | Status |
| --- | --- | --- |
| Safe beginning followed by first crevasse | `mtest_easy`, foot prototype | **Verified:** programmed controller replay `[[18,"right"],[8,"right jump"],[125,"right"]]`, 94 frames, 0 deaths; not human playtested |
| Early single-mechanic interaction | `mtest_medium`, spring-and-dash introduction | **Not verified:** landing route not recorded |
| Precision hazard following a speed or refill interaction | `mtest_hard`, summit stress prototype | **Not verified:** landing route not recorded |

The source-derived **community-mod geometry research gate remains open** until multiple actual Strawberry Jam/Spring Collab playable map binaries are acquired legally and inspected independently, with 20 or more representative rooms analyzed in full.
