# Verification gates — no unearned pass labels

G0 **Clean worktree and source provenance.** Record local `git status --short`, `git worktree list`, main SHA, untracked files and private plan version. Never overwrite a user's in-progress work.

G1 **Static source and build.** Run `npm ci --no-audit --no-fund`, `npm run check`, `npm run build`, `npm run verify`. Source `js/` must parse as ES5; portfolio build remains lazy; output only allowed files. The public CI can perform this gate.

G2 **Local behavioral suite.** Where present: `node tests/run-all.mjs`, plus newly added scenario-specific suites. Confirm save compatibility, input release and return-path invariants. Public checkout lacks most tests; gate is BLOCKED there, not PASSED.

G3 **Story reachability.** Validate every exit destination and spawn, story gate, persistent flag, return route and legal sequence. Verify developer cheats do not modify story-only Console gate.

G4 **Manual/browser interaction.** Record before, player input, animation mid-state, after, reverse traversal/re-entry and reload. Keyboard, touch, focus recovery and no softlocks.

G5 **Art and accessibility.** Pixel-grid and alpha checks; proper anchoring; compare actual gameplay-scale screenshots; no unreadable attacks, overdrawn UI or misdirected effects. Reduced motion usable; no flashes above 3Hz; WCAG AA where applicable.

G6 **Performance.** Measure source frame time, render frame time and 95th-percentile pacing on representative low/mobile, 60Hz and 120/144/240Hz environments. Fixed-step game speed must not depend on display refresh. Set numerical targets only after baseline measurements.

G7 **Release authorization.** PR reviewed, no restricted assets, no save regressions, no nonconsensual main push or deployment. A green PR is *not* permission to merge.

For any gate not executed, record `NOT RUN`, reason, device, and evidence location in `STATUS.md`.
