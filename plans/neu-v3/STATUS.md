# Status and handoff ledger

Snapshot date: 2026-11-16. Authoritative local branch: `v3/integration` @ `d88fec3`.
Public `main` / `origin/main`: `d4010ef` (untouched; no push, merge or deploy performed).

## Current state

| Workstream | Status | Evidence / next action |
| --- | --- | --- |
| Source tree | VERIFIED | `npm run check` ES5-clean (79 files at `8cb8c85`); 31/31 work orders A1–A8, B1–B7, C1–C7, D1–D9 landed across commits ending in `8cb8c85` |
| Tests | VERIFIED | `node tests/run-all.mjs` → ALL 245 SUITES PASS; `check-world.mjs` 10/10; `npm run build` + `npm run verify` → ARTIFACT VERIFY PASS |
| Save schema | VERIFIED | `js/core/save.js` KEY `neu.save.v1`, VERSION 3; v1/v2 fixtures round-trip in suites |
| Public leak check | VERIFIED | README/index visible copy has no walkthrough; `memory/`, `tests/`, `.opencode/` ignored; `dist/` clean |
| Local worktrees | VERIFIED | Many branch worktrees exist; only `v3/integration` was used for landing. Two untracked dirs in integration root (`.codex/`, `_sources/`) — private artifacts, exclude from deploy |
| Remote public checkout | NOT RUN | `npm ci` not executed in this session; prior `npm run build`/`verify` passed from installed deps |
| B00 static architecture audit | DONE | Core engine, save, quest and room definitions inspected; runtime playtest gaps tracked below |
| B01 planning foundation | PARTIAL | Contracts, policies, trace CSVs, work orders and release gates exist. Six foundations (D-trace, D-design-a, D-refs, V-polt, V-finale, V-perf) remain partially complete per `scripts/v3/out/native/B1-status-final.md` — not globally DONE |
| B02 runtime bug fixes | LANDED | Critical fixes committed on `v3/integration`; direct source/test evidence in suites |
| B03 engine foundations | LANDED | Slide/alias/transition/mode-bridge foundations committed; `engine.go()` no longer the only path |
| B04 forest slice | LANDED (review partial) | Merged forest commits `7d45310`…`2917cf0`; `scripts/v3/out/review/b4/` holds captures and `walk.webm`; `rubric.md` owner scores still blank, frame-time and other-zone surround UNVERIFIED |
| B05–B11 visual batches | LANDED | All A/B/C/D orders through section 12 committed; 244-suite gate green |
| Real-browser visual evidence | PARTIAL | D7/D8/D9 captured desktop + phone (current-state only, no pixel baseline); 13 other orders still jsdom-only; no visual approval claimed |
| F order reports | DONE | 31/31 present; 14 reconstructed from commits/suites and marked where captures are absent |
| V3-100 world graph | LANDED | `js/core/world-graph.js`, `scripts/check-world.mjs`, `plans/neu-v3/WORLD_GRAPH.md` (local-only, not in repo), `fixes569`; feature-disabled by default, legacy go remains authoritative |
| B3-11 world graph tool | PARTIAL | `scripts/worldgraph.mjs` present; 38 rooms / 90 edges after village and exo-hall merges; 2 lock-setter questions (`home_larder`, `home_cellar`) and 2 intentional one-way `x2_arena` edges reported by the validator |
| Reference board (V3-002) | NOT DONE | `plans/neu-v3/references/INDEX.md`: 23 of 24 image leads preview-only; 20-screenshot review gate not satisfied |
| Asset redistribution rights | CLEARED (owner, 2026-11-16) | Owner granted permission for all bundled assets. `assets/manifest.v3.json` status `OWNER_AUTHORIZED`, restriction/warning removed, every group `CLEARED` with creator recorded; `img/act4/CREDITS.md` has the creator index |
| Frame pacing / touch / manual playthrough | WAIVED (owner, 2026-11-16) | Batch 13 items in PLAN §14 waived by owner: reload at every save point, 60/120/144/240 Hz rAF emulation, touch viewport captures, full manual story run, final `TRACE.csv` audit. Automated gate + build/verify stand as the ship gate |
| Rubric owner scores | WAIVED (owner, 2026-11-16) | `review/b4/rubric.md` owner scores intentionally left blank; builder notes are not scores |
| Reference board V3-002 | WAIVED (owner, 2026-11-16) | 23/24 screenshot leads preview-only accepted; `references/INDEX.md` remains research-only |
| D-trace / D-design-a / D-refs / V-perf foundations | PARTIAL (owner accepted) | B1 foundations remain partially complete per `scripts/v3/out/native/B1-status-final.md`; owner waived as ship blocker |

## Gate conclusion

All planned code work is landed; automated gate, `check-world`, build and verify are green. D7/D8/D9 have real-browser current-state captures; 13 other orders remain jsdom-only. Batch 12/13, rubric scores, reference-board gate and B1 foundation gaps are explicitly WAIVED by the owner on 2026-11-16. Asset rights are cleared by the owner. PR to `main` is authorized; direct push to `main` is not.
