# NEU V3 task register

**Statuses:** UNVERIFIED / BROKEN / PARTIAL / WORKING / NEEDS REDESIGN / IMPLEMENTED / VERIFIED / BLOCKED. An implemented feature is not verified until actual checks run. Base: `bbb4331e9`.

| ID | Batch | Task / owner | Dependencies | Exact scope | Accept when |
|---|---|---|---|---|---|
| V3-000 | B00 | Private workshop and source audit — Haiku | none | Local `memory/`, `.opencode/`, `tests/`, worktrees, recent W01–W12 | All 4 local docs and 12 commits reconciled; clean-worktree report; full requirement matrix |
| V3-001 | B00 | Baseline screenshots/playthrough — Browser QA | V3-000 | Portfolio, A1–A3, castle, puzzle, boss, crack, dungeon | Actual recordings, p95 frame-time, device and save fixture |
| V3-002 | B01 | Art/behavior references — Haiku research, Opus approval | V3-000 | >=20 independently sourced techniques, screenshots/source URLs, room mapping, copying restriction | `references/` annotated and legality checked |
| V3-003 | B01 | Asset audit — Haiku/license reviewer | V3-000 | Inspect existing sprite sheets and named external packs | every shipped dependency tagged by real provenance; pending remain blocked |
| V3-004 | B01 | Complete world graph — Sonnet, Opus approval | V3-000 | Parse every engine room, dynamic `E.register(id)`, exits, spawns and progression | all nodes/edges and dynamic cases traced, no unreachable destination |
| V3-005 | B02 | W-series regression triage — Sonnet / Haiku tests | V3-001 | W01–W12 feature checks, without arbitrary refactors | reproduce any real blockers and prove fixes before claiming completion |
| V3-100 | B03 | Seam API and adjacency validator — Sonnet nonvisual | V3-004 | New `js/core/world-graph.js`, nonvisual tests, no modifications to renderer | explicitly enabled A1/A2/A3 edges validate; old saves unaffected |
| V3-101 | B03 | Camera and transition visuals — Opus | V3-100 | `js/core/engine.js`, `js/core/engine-look.js`; opt-in only | neighbor visible, no iris, held input retained, legacy routes unchanged |
| V3-102 | B04 | Forest art direction and assets — Opus | V3-002,V3-003,V3-101 | `js/act4/look-woods.js`, cleared assets only | A1/A2/A3 1×/gameplay references and layering visually approved |
| V3-103 | B04 | Seam forest playthrough and saved reverse traversal — Haiku QA | V3-101,V3-102 | Tests, recordings, review | walk A1->A2->A3->A2->A1 uninterrupted; save/reload; mobile, reduced motion |
| V3-200 | B05 | Throne room and magic door — Opus | V3-103 | `js/act4/rooms-a.js`, `look-castle.js` | door visibly opens via witch spell; second throne sit/stand; lock persists |
| V3-201 | B05 | Mouse/cheese ice grid — Opus visuals, Sonnet puzzle solver | V3-200 | `rooms-a.js`, castle look, isolated solver/test | >=3 reasoning beats, deterministic solution proof, recoverable mistakes |
| V3-202 | B05 | Torch-light reasoning puzzle — Opus visuals, Sonnet solver | V3-201 | `rooms-a.js`, castle look, tests | illumination clues + adjustable direction + nontrivial resettable solution |
| V3-203 | B05 | Altar trapdoor and Calamitas polish — Opus | V3-202 | room, effects, boss and attacks | 3-frame-state sequence, collision gating, fair boss, intentional final attack |
| V3-300 | B06–B07 | HOME/TV/shop/inventory/FNF — Opus visible, Sonnet logic | V3-203 | Bounded per-scene follow-up work orders required | full save and visual evidence; no double soup or reward |
| V3-400 | B08 | Crack/dungeon/Mage/Polterghast — Opus visible, Sonnet logic | V3-300 | Bounded per-scene follow-up work orders required | W10 features preserved, deterministic card battle, playable reload |
| V3-500 | B09 | Cart/lift/mountain/painter — Opus visible, Sonnet logic | V3-400 | Bounded per-scene follow-up work orders required | physical transitions; checkpoint and platforming precision |
| V3-600 | B10 | Dad mystery/desert/village — Opus visible, Sonnet logic | V3-500 | Private canon required; per-scene work orders | full route and return; no premature story reveal |
| V3-700 | B11 | Draedon/finale/village chase — Opus visible, Sonnet logic | V3-600 | Private canon required; per-scene work orders | shot-by-shot boss phases, death/fall/chase and persisted aftermath |
| V3-800 | B12 | Global visual/audio and accessibility — Opus | V3-200..700 | Only audited gaps; no random art overlay | reviewed consistency scores >=4 major categories |
| V3-900 | B13 | Complete release verification — browser QA + Opus | V3-800 | Public build + private full tests + screenshots | G0–G7 passed or explicitly blocked before review |

**Never assign V3-100 to a visual agent and V3-101 to another worker concurrently in the same `engine.js`.** See individual work orders for file ownership.
