# NEU contributor and agent contract

This is a **public source repository** for a hidden game inside a portfolio. Do not spoil game discovery in the public-facing README, home page or copy. The full private walkthrough and locally ignored plans may exist in the author's workstation but are **not in this repository**. Never invent their contents.

## Read first
1. `README.md`, `package.json`, `index.html`, `.gitignore`, `.github/workflows/deploy.yml`.
2. `plans/neu-v3/PLAN.md`, `STATUS.md`, `TASKS.md`, `DEPENDENCIES.md`, `RELEASE_GATES.md`.
3. Applicable `design/*.md` and the current `js/act4/rooms-*.js` and `js/core/*.js`.
4. The local `memory/PLAN.md`, `memory/story.md` and other private notes **if mounted**; record “not available” otherwise.

## Nonnegotiable engineering rules
- JavaScript shipped under `js/` remains ES5 IIFE code attached to `window.NEU`. No unapproved `let`, `const`, arrow, class, optional chaining or ESM in game code. Tools under `scripts/` may use modern JS.
- Preserve `index.html` script order; `js/core/quest.js` owns objective progress; `js/core/save.js` owns persistent state, currently schema v3 under `neu.save.v1`.
- Do not introduce a second authority for an item, flag, room, camera or input binding. Maintain migration of historical saves, idempotent effects and reduced-motion behavior.
- Keep gameplay mode boundaries separate: exploration, platforming, rhythm, soul combat and cards must not steal input from each other.
- Story Console, early page/TV launcher, and developer cheat console are distinct. Never unlock story-only Console progression through a technical shortcut.
- Existing fixed 60 Hz simulation, swept collisions, 16px tile grid, camera easing and Pages build are starting constraints, not reasons for wholesale replacement.
- Every visible change requires real-browser before/during/after evidence; a jsdom-only test does not prove visual quality. Never report unperformed tests as passing.
- Public assets must have documented rightsholder/license/redistribution clearance before new reuse. `img/act4/calamity/`, `img/act4/deltarune/` and `img/act4/terraria/` are **rights-review queues**, not evidence of permission.
- Do not add local secrets, source rips, worktrees, screenshots or private walkthroughs to deployable `dist/`. A new text file can be public on GitHub even if `dist/` excludes it.

## Work protocol
- Inspect Git status/worktrees on the *actual* machine before touching implementation. GitHub remote inspection cannot prove local changes are clean.
- One bounded task, one branch/worktree, explicit allowed files and owner; avoid simultaneous edits of the same path.
- Fix behavior before broad refactors. Prefer reversible adapters over moving all room files.
- Record each requirement as UNVERIFIED, BROKEN, PARTIAL, WORKING, NEEDS REDESIGN, IMPLEMENTED, VERIFIED or BLOCKED with concrete evidence.
- Use `npm ci && npm run check && npm run build && npm run verify` for the **tracked public checkout**. Run `node tests/run-all.mjs` only where the author's local-only suite is present. Never falsely claim all 185 suites run in GitHub CI.
- The website deploys from `main`. **Do not merge, push directly to main or trigger Pages deployment without explicit authorization.**
- Work order format: task ID, base SHA, files owned, forbidden paths, dependencies, before/after, screen choreography, flags/spawns, assets, checks, screenshots, rollback.

## Review and escalation
Block or flag tasks when they would leak hidden story spoilers, overwrite a local-only revision, change save semantics without migration tests, or require unlicensed assets. Verify current `main` before rebasing.
