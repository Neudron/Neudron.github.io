# Work order — wave-A sweep fixes (all verified against source)

Six defects found by scout wave, each verified by the orchestrator. One
builder dispatch. Regression assertions live in tests/fixes18.mjs as new
section "19. wave-A sweep" (source-level asserts in this suite's existing
style; behavioural where jsdom makes it cheap).

## W1 — engine.enter() stacks a second rAF loop (CRITICAL)
`js/core/engine.js` enter() (~line 927) unconditionally sets
`running = true` and calls `requestAnimationFrame(step)` even when already
running. rhythm.close() and craft's quit now legitimately call
engine.enter() WHILE the room runs (input-ownership fix, 2026-08-22), so
two step loops tick simultaneously → double-speed simulation.
FIX: only spawn the loop when not already running (`if (!running) { … }`
around the rAF spawn); keep keys={} / busy=false / land() resets.
TEST: assert enter() twice leaves exactly one loop observable (e.g. spy on
requestAnimationFrame count across two enter calls, or assert via a run
counter over N frames that dt-normalised progress is single-rate).

## W2 — settings.close() strips the room's `is-playing`
`js/core/settings.js:287` removes body.is-playing unconditionally; its own
open() (:273) adds it. Opened over a live room, closing settings strips
the room's class.
FIX: capture whether body had is-playing BEFORE adding it in open(); on
close, restore that prior state instead of removing unconditionally.

## W3 — settings/dev Escape also quits the live room
settings.js:304 and dev.js:254 handle Escape without stopPropagation, so
the engine's window handler (leave()) fires too — dismissing the panel
over a room quits the room.
FIX: when the panel consumed Escape, call e.stopImmediatePropagation()
(or stopPropagation) after preventDefault. dev.js input already does this
for its own field (line 258) — mirror it on the window-level branch.

## W4 — boss-scal.open() forgets charge state → softlock
open() (1298-1318) resets everything EXCEPT chargeT / chargeTelegraph /
chargeBurst / chargeBurstMax / chargeGap (vars at :259, set at :253).
Dying mid multi-charge then retrying can hit an early-return forever.
FIX: zero all five in open()'s reset block alongside diveT.
TEST: fixes18 asserts the open() block mentions all five names.

## W5 — boss-polt stale charge timer leaks across reopen
boss-polt.js:196 schedules setTimeout(doCharge, 900) untracked. close()
then reopen() inside 900ms re-arms `running`, so the stale callback fires
into the NEW fight untelegraphed.
FIX: keep the timer id in a module var; clearTimeout in close().
TEST: fixes18 asserts close() clears it (source assert acceptable).

## W6 — rhythm phase-switch timeout survives close/reopen
rhythm.js:96-101 schedules the call→response chart concat with only a
`running` guard. Reopen inside the window lets a STALE timeout concat
duplicate notes onto the new round.
FIX: track the timeout id; clearTimeout at the top of startRound() and in
close().
TEST: fixes18 asserts both clears exist.

## Constraints
ES5 only; smallest diffs; match each file's comment voice; hands-off paths
stand. node --check every touched file. fixes18 section 19 first (TDD),
then implementations.

## Acceptance
Every W# has its assertion; full suite green afterwards (verifier runs it).
