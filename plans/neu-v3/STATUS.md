# Status and handoff ledger

Snapshot date: 2026-11-09. Remote public main: `bbb4331e9ded30a9160bee3d087d6f08cc3479eb`.

| Workstream | Status | Evidence / next action |
| --- | --- | --- |
| Public GitHub remote / tracked tree | VERIFIED | Connector inspection: 363 tree entries, 78 JS paths, 186 image paths, 9 audio paths, 3 tracked tests; see repository tree |
| Local workstation and worktrees | BLOCKED | Not exposed through GitHub; owner/agent must run git status, worktree list, local test command |
| Private source documents / local plans | BLOCKED | `memory/` and `.opencode/` ignored and absent from public tree |
| B00 static architecture audit | PARTIAL | Core engine, save, quest and major room definitions inspected; full runtime still unplayed |
| B01 planning foundation | IMPLEMENTED | Agent contract, design policies, preliminary traceability, work orders, release gates, manifest; verify on this branch |
| B02 runtime bug fixes | UNVERIFIED | No direct edits to live game code in foundation |
| B03 seamless transition core | UNVERIFIED | `engine.go()` still irises; needs isolated implementation and tests |
| B04 first forest seamless slice | UNVERIFIED | Exact design brief staged; needs art + code + browser test |
| B05–B13 redesign | UNVERIFIED | Phased plan only |
| Screenshot and mobile evidence | BLOCKED | Browser/workstation playtest session needed |
| Commercial asset redistribution rights | UNVERIFIED | Existing asset folders include franchise names; permission requires primary-source review |
| Remote public checkout CI | UNVERIFIED | `npm run check/build/verify` exists; no claim executed in this session |

## Important source findings
- The main README still describes a local `tests/run-all.mjs` and memory walkthrough, but those files are **not included** in the remote public Git tree.
- `js/core/engine.js` `go()` (circa lines 533–544) still locks inputs and irises before `land()`. `land()` resets player velocity and camera and captures save.
- A1, A2 and A3 each have their own room grid/spawn state. Moving through their exits currently invokes the shared room mechanism; a seam feature must work at both directions, including A2's two-bank loop.
- B1 second throne presently has dialogue but no sit/stand interaction. The east exit gate uses `witch_met`, written on the last dialogue line. Any cinematic must gate physical opening while keeping that persisted state.
- B4 is currently a four-plate slide-ring mechanic; the replacement mouse/cheese design is proposed, not implemented.
- B6 currently takes a torch to a central socket; the desired observation/reflection puzzle is proposed, not implemented.

## Checkpoint ritual
When beginning a work session, update baseline SHA, working tree status, blocked resources, exact test output and new screenshots. Never mark VERIFIED without an observable test or reviewed visual artifact.
