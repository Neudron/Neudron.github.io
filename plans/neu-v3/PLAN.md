# NEU V3 — implementation directorate

**Baseline:** public `Neudron/Neudron.github.io` main at `bbb4331e9ded30a9160bee3d087d6f08cc3479eb` (2026-11-09). **Document type:** execution scaffold, not a claim that the 13 redesign batches have been delivered.

## Mission and verified facts
Turn the existing hidden pixel-art adventure into a coherent, art-directed, physically connected and responsive world while preserving progression and the portfolio's fast initial load.

Repository inspection confirms:
- Existing source is plain ES5 game IIFEs under `js/core/`, `js/game/`, `js/act4/` with a production esbuild pipeline.
- `engine.js` uses 16px tiles, fixed 60Hz simulation, swept collision, camera interpolation and `go()` -> iris -> `land()` for most room traversal.
- `rooms-a.js` currently contains A1 clearing, A2 path, A3 fork and B1–B8 castle data. `a1` -> `a2` -> `a3` is the priority contiguous forest slice.
- `save.js` uses key `neu.save.v1` with schema `VERSION = 3`; old saves must continue working.
- Last twelve W-series commits include new save, console dev commands, crack sky arrival/bed, recall, vending, rhythm and sprite fixes. Those features are *audit targets*, not automatically broken.
- The public checkout omits the private `memory/`, `.opencode/`, most `tests/` and `_scripts/` tooling by design. Public GitHub cannot prove the private full suite passes or inspect unstaged worktrees. Nothing here overrides their absent canon.

## Stage A — UltraPlan before broad redesign
0. On the author's workstation: inspect `git status --short`, `git worktree list`, `git log -20 --oneline`, `origin/main`, local-only sources and private work. **Do not overwrite them**.
1. Build source-backed inventory of rooms, exits, spawns, flags, equipment and visual assets. Assign evidence to requirements. See `requirements.csv`, `WORLD_GRAPH.md`, `assets/manifest.v3.json`.
2. Play every relevant current scene in a real browser and record before/trigger/intermediate/after states and measured frame time. The source audit is *not* the playtest.
3. Resolve canon conflicts; especially preserve the post-Polterghast Console gate, persistent saving and newly implemented W01–W12 features.
4. Approve art bible and exact scene screenplays before agents touch rendering. Set sprite/tile dimensions from actual authored art, not guessed dimensions.
5. Create atomic work orders with file ownership, acceptance and rollback; route visual implementation to Opus.

## Stage B — batches, in dependency order
- **B00** preserve and audit remote + private workshop, baseline performance, full requirements.
- **B01** workspace policies, source manifests, story boundaries, agent contracts, CI and reference board.
- **B02** fix confirmed progression blockers only; verify W01–W12 regressions.
- **B03** WorldGraph, TransitionDirector, CameraDirector and save-aware seam logic behind opt-in flags.
- **B04** A1/A2/A3 forest seamless vertical slice with reverse traversal, camera and ambience continuity.
- **B05** B1–B8 castle staging, Calamitas spell door, second throne, hard fair ice/torch puzzles, altar and boss.
- **B06** city/HOME/Tenna/prizes, recall and vending.
- **B07** inventory/crafting/equipment/merchant rhythm and soul interludes.
- **B08** crack/dungeon/bed/Mage/card battle/Polterghast.
- **B09** cart/elevator/mountain/painter.
- **B10** Dad mystery/desert/village/snail.
- **B11** Draedon/Exo/finale/chase and aftermath.
- **B12** art, audio, accessibility, camera and transition consistency.
- **B13** all-mode playthrough, mobile, high-refresh, save migration, visual proof and release gates.

## Architecture — strangler migration, not rewrite
Use existing `NEU.engine.register` rooms and legacy exits initially. Add an opt-in directional adjacency map derived from verified room edges (no implicit geography). A transition controller classifies seam, physical, vertical, supernatural, cinematic or gameplay-mode transitions. Preserve old `go/land` as fallback while independently testing new seam logic. Never teleport through a nonadjacent dimension merely because two scene IDs happen to be neighbors in a graph.

`WorldGraph`: canonical stable IDs, exit/return spawn, gate, type, two-way check and state-based redirects. `TransitionDirector`: phased departure/stream/arrival, cancellation and input ownership. `CameraDirector`: world-coordinate follow and bounds blending, separate camera shakes. `SaveAdapter`: schema-v3-compatible stable room/position/checkpoint migration. `AudioDirector`: continuous regional ambience, event cues and reduced sensory alternatives.

## Evidence hierarchy
Source-confirmed API or route > automated behavior check > full browser playthrough > measured performance > screenshot visual review. Do not infer visual quality from compile success. Every task needs a before/after recording or screenshot evidence where it changes the screen.

## Scope boundary
This foundation supplies scaffolding, policies and work orders. It does not falsely state that all region graphs, all story details, all 24 image assets or all 185 local test suites have been inspected, authored or verified. The private workshop specifications and browser recordings are prerequisites for exhaustive traceability.
