# Block-mirror puzzle room — remaining fixes plan

**Status:** 29 source files modified, 1 test regression (fixes16 184/185).  
**Workdir:** `C:\Users\Neudron\Documents\neu\site`  
**Run tests:** `node tests/fixesNN.mjs` from that directory.

---

## 1. Fix the one broken regression (5 min)

**File:** `tests/fixes16.mjs` line 473  
**Test:** `>>> the Tab trap includes inputs, not just buttons <<<`  
**Regex:** `/querySelectorAll\('button, input'\)/`  
**Actual source:** `panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')`

The `:not(:disabled)` suffix was added during the MEDIUM 6 fix but the source-test regex wasn't updated.

**Change:**
```js
// old
/querySelectorAll\('button, input'\)/.test(S)
// new
/querySelectorAll\('button:not\(:disabled\), input:not\(:disabled\)'\)/.test(S)
```

Verify: `node tests/fixes16.mjs` → 185/185.

---

## 2. Already-applied fixes — verify with regression tests

These source edits are in the working tree but need their new test sections run:

| Fix | File | Test location | Expected |
|-----|------|---------------|----------|
| LOW 13 — engine blur clears keys | `js/core/engine.js` | add §4c to `tests/fixes8.mjs` (engine suite) | blur/visibilitychange → `keys = {}` |
| LOW 14 — quest missing-DOM guard | `js/core/quest.js` | add §5c to `tests/fixes7.mjs` | Tab with `#quest` removed → no throw |
| LOW 19 — sans CARRY stray-tap drop | `js/game/sans.js` | add §7c to `tests/fixes5.mjs` | tap elsewhere while holding → `state='stuck'` |
| LOW 22/23 — npc-in-wall x2 | `js/act4/rooms-g.js`, `js/act4/rooms-d.js` | add §10a/10b to `tests/fixes9.mjs` | npc tile is walkable (not `#`) |
| LOW 24 — scal pending-timer bleed | `js/act4/boss-scal.js` | add §9c to `tests/fixes13.mjs` | phase transition → no stray bullets |
| LOW 25 — scal phase-2 charge coin flip removed | `js/act4/boss-scal.js` | update §9b source assert | no `Math.random()` in charge branch |

---

## 3. Still-pending LOW findings — implement + test

> **✅ RESOLVED 2026-08-22 — nothing pending here.** Audited against source
> and suites: LOW 15 (clearStick latch) and LOW 16 (keyup latch invalidation)
> are implemented in `js/core/touch.js` and pinned by fixes15 §LOW-15/16;
> LOW 17 (`goto` teleport) is implemented in `js/core/dev.js` and pinned by
> fixes12 §9a. Every entry below is a historical record of the fix design,
> not outstanding work.

### LOW 15 — `touch.js` releaseAll doesn't clear stick pointer latch

**File:** `js/core/touch.js`  
**Problem:** `releaseAll()` sends keyup for all held keys but leaves `stick.id` latched. After blur/visibility-change, the stick visually stays "down" and rejects new pointer events from different pointerIds.

**Fix:** Add a `clearStick` callback, set it from `wireStick`:
```js
// near line 138
var clearStick = function () {};

// inside wireStick, after killRepeat = stopRepeat;
clearStick = function () { end(null); };   // end(null) skips the pointer-id guard

// in releaseAll:
function releaseAll() {
  killRepeat();
  clearStick();
  for (var k in held) if (held[k]) send(k, false);
}
```

**Test:** add to `tests/fixes14.mjs` (touch suite) — simulate pointerdown, call `NEU.touch._release()`, assert `stick.classList.contains('is-down')` is false.

### LOW 16 — `touch.js` send() dedupe stale vs physical keys

**File:** `js/core/touch.js`  
**Problem:** If the player releases a physical key while the pad still holds it, the pad's `held` map stays `true` and the direction stops being re-sent on the next `pointermove`.

**Fix:** Add a keyup listener that invalidates the pad's latch:
```js
addEventListener('keyup', function (e) {
  if (e && held[e.key]) held[e.key] = false;
});
```

**Test:** add to `tests/fixes14.mjs` — press physical ArrowLeft, then touch pad-left, release physical, move thumb → direction still sent.

### LOW 17 — `dev.js` goto is a stub

**File:** `js/core/dev.js` line 148  
**Problem:** `goto` only prints the room list; it never teleports.

**Fix:**
```js
goto: function (room) {
  if (!room) {
    log('usage: goto <room>. rooms: ' +
      (NEU.engine && NEU.engine.rooms ? NEU.engine.rooms.join(' ') : '(engine not loaded)'));
    return;
  }
  if (!NEU.engine || !NEU.engine.enter) { log('engine.js not loaded'); return; }
  hide();
  if (NEU.engine.enter(room)) log('now in ' + room + '.');
  else log('no room "' + room + '". try the list.');
}
```

**Test:** add to `tests/fixes12.mjs` §9 — `NEU.dev.run('goto h3_trip')` → `NEU.engine.running && NEU.engine.room === 'h3_trip'`.

### LOW 18 — `deck.js` Enter on quit button launches game

**File:** `js/game/deck.js` line 341  
**Problem:** Enter/Space on the focused `deckQuit` fires both the native click (close) and the keydown handler (launch), starting a game the player just tried to leave.

**Fix:**
```js
if (e.key === 'Enter' || e.key === ' ') {
  if (document.activeElement === q) return;   // let the button close
  e.preventDefault();
  launch();
}
```

**Test:** add to `tests/fixes10.mjs` §7c — focus `deckQuit`, dispatch Enter → `open_` stays false.

### LOW 20 — `sans.js` 6s backstop lacks onScreen guard — **DELIBERATE, no change**

The 1200ms backstop already checks `!onScreen`. The 6000ms backstop is an unconditional guarantee ("if the page cannot scroll, nothing will ever leave the screen, and a queued sleep that never fires is a dead end"). Making it conditional on `!onScreen` would break the guarantee for tall viewports where the section is always visible. No code change; note in summary as verified-deliberate.

### LOW 21 — `sans.js` chain flags reset on reload vs panel 16/16 — **DELIBERATE, no change**

`quest.js` persists `done`/`counts` via `save.js` (achievement record). `sans.js` module flags (`hasKey`, `state`, `dogOut`, etc.) are intentionally per-session (physical replayability). The panel is history; the world is a replayable stage. `replay()` exists for genuine repeatable loops (greydoor/answers/clicker/fixed). No inconsistency — the dog-out fix (MEDIUM 8) depends on this contract. No code change; note in summary as verified-deliberate.

### LOW 26 — quiz Enter-retry lastFocus — **ALREADY FIXED**

Landed as part of HIGH 4 (quiz askTimer/lastFocus/open_ guards). Regression in `fixes10.mjs` §6b is green. Skip.

### LOW 27 — `rhythm.js` retry after loss resets round

**File:** `js/act4/rhythm.js` lines 275, 284-293  
**Problem:** `lose()` sets `running=false`. Enter retry calls `open()`, which does `round = 0` — the player replays from round 1 instead of the round they lost.

**Fix:** Extract a `retry()` that preserves `round`:
```js
function retry() {
  wrap.hidden = false;
  document.body.classList.add('is-playing');
  if (NEU.quest) NEU.quest.lock(true);
  if (msg) msg.hidden = true;
  layout();
  hp = 0.5; keys = {}; judged = '';
  running = true;
  startRound();
  requestAnimationFrame(step);
}
// keydown: if (!running && e.key === 'Enter') { e.preventDefault(); retry(); return; }
// open() keeps round=0 reset (fresh battle); retry() keeps current round
```

**Test:** add to `tests/fixes9.mjs` — lose round 2, Enter → `NEU.rhythm.round === 2`.

### LOW 28 — `rhythm.js` 400ms response timeout guarantees a MISS

**File:** `js/act4/rhythm.js` line 101  
**Problem:** `setTimeout(..., 1400 + 4 * beatLen() * 1000 - 400)` — the `- 400` makes the response phase start 400ms before the player's bar arrives. With `WINDOW = 0.14s` (140ms), the player's first note spawns at `t0 + 4*bl` but phase is already "response" at `t0 + 4*bl - 400ms`. The note is 400ms early — far outside the 140ms window → guaranteed MISS on the first note.

**Fix:** Remove the `- 400`:
```js
}, 1400 + 4 * beatLen() * 1000);
```

**Test:** add to `tests/fixes9.mjs` — open round 0, advance to response phase, assert first response note `n.t - now() >= WINDOW` (within window, not early).

### LOW 29 — `act4.js` rooms deref unguarded

**File:** `js/act4/act4.js` lines 62-63  
**Problem:** `NEU.engine.rooms` is accessed without a guard — if `engine.js` failed to load, `NEU.engine` exists (stub) but `rooms` is undefined, so `.indexOf` throws.

**Fix (already applied):**
```js
var s = (NEU.save && NEU.save.data) || {};
var rooms = (NEU.engine && NEU.engine.rooms) || [];
var resume = s.room && rooms.indexOf(s.room) >= 0;
```

**Test:** add to `tests/fixes7.mjs` — boot without `engine.js`, call `NEU.act4.open()` → no throw, returns `false`.

---

## 4. Test additions — which suite for each

| Suite file | Add sections for |
|------------|-----------------|
| `tests/fixes5.mjs` | LOW 19 (sans CARRY stray-tap) |
| `tests/fixes7.mjs` | LOW 14 (quest no-DOM guard), LOW 29 (act4 rooms guard) |
| `tests/fixes8.mjs` | LOW 13 (engine blur clears keys) |
| `tests/fixes9.mjs` | LOW 22/23 (npc walkable), LOW 27 (rhythm retry round), LOW 28 (rhythm timing) |
| `tests/fixes10.mjs` | LOW 18 (deck Enter on quit) |
| `tests/fixes12.mjs` | LOW 17 (dev goto teleport) |
| `tests/fixes13.mjs` | LOW 24 (scal timer bleed) |
| `tests/fixes14.mjs` | LOW 15 (touch stick clear), LOW 16 (touch dedupe latch) |
| `tests/fixes16.mjs` | Fix the broken regex on line 473 |

---

## 5. Full suite run (10 min)

```powershell
Get-ChildItem tests\fixes*.mjs | ForEach-Object { node $_.FullName }
```

Target: every file prints `ALL PASS`. Current count is ~1,290 checks across 13 suites.

---

## 6. Deploy (after explicit user approval)

Pre-requisite — set `_deploy` git identity (currently missing):
```powershell
cd C:\Users\Neudron\Documents\neu\_deploy
git config user.name "Neudron"
git config user.email "neudron.troll@gmail.com"
```

Deploy command:
```powershell
"deploy`n<message>" | pwsh -File _scripts\deploy.ps1
```

The script pipes the confirm + message to its `Read-Host` step. Verify live at https://www.neu.ac.

---

## Open decisions / notes

- **LOW 20 and LOW 21 are deliberate by design** — no code change; add a one-line comment in the summary so the audit ledger can close them.
- **fixes16 test regex** — the simplest correct fix is to update the regex to match the actual selector `'button:not(:disabled), input:not(:disabled)'`. Don't weaken the selector to match the old regex — the `:not(:disabled)` is load-bearing for the actual Tab-trap behavior.
- **rhythm.js retry vs open** — `open()` must keep `round = 0` (fresh battle from round 1). `retry()` preserves the current round. The `NEU.rhythm` API exposes `get round()` so tests can assert.
- **rhythm.js timing** — the `- 400` was likely a leftover from an earlier `off = 4 * bl` design where the response started mid-bar. With 8-beat charts the offset is wrong. Removing it makes the first response note arrive inside the 140ms window.
