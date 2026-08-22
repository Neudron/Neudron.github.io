# Work order — wave-C sweep (all orchestrator-verified)

## D1 — dark.js: endless runs can complete the story chain
`interact()` (line ~113): the mode==='dark' branch has NO endless gate.
A library-launched blackout lets you walk to the grey door, hear the four
lines, bump 'answers', then get through=true + quest.mark('clicker') +
grantClicker() + toWalk() onto the live page — contradicting the endless
design comment at :322 ("no grey door").
FIX: first line of the dark-mode path (before `if (!near(DOOR)) return;`):
`if (endless) return;`

## D2 — bullet.js: ghost death loop kills the next run
deathStep (:567) checks neither running nor wrap.hidden. Restarting via
Enter mid-death-animation leaves a stale rAF whose huge `ms` flips
finish(false) on the fresh run.
FIX: first line of deathStep: `if (!dying || wrap.hidden) return;`
(dying is reset by finish/start; wrap.hidden covers post-ESC).

## D3 — bullet.js: dead tuning constant
Line 47 declares BL_HALF=24 ("matches visual beam width"); line 90
re-declares BL_HALF=17, silently reverting it.
FIX: remove `, BL_HALF = 17` from line 90's var list so :47 governs.

## D4 — deck/bullet/dark: double-open spawns double loops
deck.js open (~:267), bullet.js open (~:663), dark.js open (~:332) lack
re-entry guards — chip-spam or double-click starts two step loops.
FIX: each open() early-returns when already running/open_ (mirror quiz's
`if (open_) return;`). For bullet/dark also re-run layout/reset safely —
guard FIRST, then existing init.

## D5 — crack.js: two defects
a) Reload with crack_clicks>=3 restores opened=true but nothing schedules
   Polterghast, and hit()'s `opened` guard makes the portal inert forever
   (unless he is already dead). FIX: when opened and clicked, if
   `!(NEU.save && NEU.save.flagged('polt_dead'))` and NEU.polt exists,
   call NEU.polt.open(); return either way.
b) Every knock constructs a new AudioContext and never closes it —
   browsers cap live contexts. FIX: lazily create ONE module-level ctx,
   reuse across knocks.

## D6 — craft.js: take() has no completion guard
After matches(), the 3200ms close/wake delay leaves the grid matching;
another Enter re-runs take(): duplicate soup, mushrooms taken twice,
stacked timers.
FIX: module `var taken = false;` — take() returns if taken; set true at
the top after the matches() check; open() resets it to false.

## Tests
tests/fixes18.mjs new section "20. wave-C sweep": source-level asserts for
D1-D6 (endless gate present, deathStep guard, single BL_HALF declaration,
three re-entry guards, crack polt_dead branch + single ctx pattern, craft
taken guard). TDD: section first, red, then implementations.

## Constraints
ES5 only, smallest diffs, hands-off paths stand, node --check everything
touched (dark.js, bullet.js, deck.js, crack.js, craft.js, fixes18.mjs).
