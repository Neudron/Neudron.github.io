# Phone features — make every feature work on a phone

Work order for the builder waves. Source of truth: the orchestrator
inspection of 2026-08-27 against `js/core/touch.js`, `js/act4/boss-scal.js`,
`js/game/*.js`, `css/style.css`, and the bug tracker. Nothing below is a
guess; line numbers refer to the current `main` checkout.

Through-line: the whole game is keyboard-driven (32 `keydown`/`keyup`
listeners, one per scene). Phone support rests on **one file** —
`js/core/touch.js` — which draws a stick + buttons and synthesises real
`KeyboardEvent`s, so scenes need no changes. The gaps are the scenes whose
keys the pad does not yet map, plus the two open items nobody has proved
on a real rendering engine.

## Decision taken (user, 2026-08-27)

The Supreme Calamitas fight needs four thumb actions (strike `f`, rage `z`,
barrier `x`, focus `Shift`) but the pad has three buttons. Chosen option:
**hold-A to charge**, keeping three buttons.

- **A** = `f` (strike). Tap = quick strike (keydown → quick keyup →
  `tryHit` at low power). Hold = charge (keydown stays → `keyup` on
  release → `tryHit` at charged power). This reuses the existing
  `xHold` mechanism via a new `aHold` flag.
- **X** = `z` (rage) on tap; **long-press X** (>500ms hold) = `x`
  (barrier). Needs a long-press timer in `wireButton`.
- **B** = `Escape` (back/confirm-exit). Unchanged.
- **Focus `Shift`** is dropped from the fight profile. Precision dodge
  relies on the stick's diagonals, which already work. This is the
  tradeoff the user accepted.

## The gaps → root causes

| # | Feature | Gap | Where |
|---|---|---|---|
| G1 | Supreme Calamitas fight | `f`/`z`/`x` have no touch mapping; `scal` profile only has stick + `Enter`/`Escape`/`Shift`. Pad has 3 buttons, fight needs 4 actions. | `touch.js:63-65`, `boss-scal.js:1666-1700` |
| G2 | Dialogue box (sans) | Pad hides during `#tbox` (`talking()`); advance is tap-the-box (`sans.js` binds `click`). Likely fine — verify, don't assume. | `touch.js:349-356`, `sans.js` click |
| G3 | Act I-III intro 3D cube | `scene.js` uses real Pointer Events (already touch-native). `fitCamera()` fov=44 below 720px untested below 390px. | `scene.js:311-343,364-370` |
| G4 | Deck launcher | `deck` profile maps `x`→`Tab` with `repeat:true`; repeated `Tab` can escape to mobile browser chrome. Play/Quit are real `click` buttons. | `touch.js:87-89`, `deck.js:324-354` |
| G5 | Settings panel | Opens via `click` gear (works). No pad profile (dialog). Music `input[type=range]` is fiddly with a thumb; thumb may be undersized for touch. | `settings.js:107,244`, `style.css:1757-1779` |
| G6 | Page chrome / lights | 3D cube is `position:fixed; z-index:70` full-screen; lights toggle is in page flow. Verify nothing is permanently obscured. | `main.js:345`, `style.css:1370` |
| G7 | Soundtrack out loud | Open since 2026-08-19: jsdom proves the schedule, not the sound. Needs `OfflineAudioContext` render per track. | `pending.md` §3.5 |
| G8 | Full phone playthrough | No human has played Acts I-IV on a phone end-to-end. Calamitas fight "owed a phone-viewport playtest." | `BUG Tracker.md:84`, `pending.md` §3.5 |

## Skills used

| Skill | Source | Use for |
|---|---|---|
| `browser-uat` (installed) | `.claude/skills/browser-uat` | Headless Chrome 390×844 dpr3 touch+coarse via `chrome-devtools-mcp`. The ONLY tool that proves layout/tap/sound. Repo convention. |
| `verify` (installed) | `.claude/skills/verify` | jsdom gate: 1487 checks / 15 suites. Every code change runs through this first. |
| `mobile-design` checklist (reference only, NOT installed) | vudovn/ag-kit | Touch-target sizing rule: ≥44px, ≥8-12px gap. Borrowed as a rule of thumb for G1/G5. ([source](https://claudeskills.info/skills/vudovn/ag-kit/mobile-design/)) |

Web search found mobile-testing skills (proffesor-for-testing/agentic-qe,
mobile-app-testing, Maestro, Appium, Espresso) — all target **native**
iOS/Android apps and need tooling this no-build web repo cannot use. Not
installed; `browser-uat` covers the web touch path better.

## Phases

### Phase 1 — Calamitas fight on phone (G1) — the big one

`js/core/touch.js`

**1a New `aHold` flag (charge-and-release on A):**
The `scal` profile (`:63-65`) currently:
```js
{ id: 'scal', on: ..., a: 'Enter', aLabel: 'ok', b: 'Escape',
  x: 'Shift', xLabel: 'focus', xHold: true, stick: true }
```
Rewrite to:
```js
{ id: 'scal', on: function () { return NEU.scal && NEU.scal.running; },
  a: 'f', aLabel: 'strike', aHold: true,
  b: 'Escape',
  x: 'z', xLabel: 'rage', xLong: 'x', xLongLabel: 'barrier',
  stick: true }
```
- `aHold: true` → A stays down while held (charge), releases on pointerup
  (`tryHit` fires on keyup). Reuses the `xHold` path; extend the release
  guard in `wireButton` (`:212`):
  ```js
  if (tap || (!cur.xHold && !cur.aHold)) requestAnimationFrame(function () { send(k, false); });
  ```
- `wireButton(btnA, ..., true)` (`:191`) → change third arg to `false` so
  A does not auto-release: `wireButton(btnA, function () { return cur && cur.a; }, false)`.

**1b Long-press on X (tap=rage, hold=barrier):**
`wireButton` (`:200-224`) gains a long-press timer when `cur.xLong` is set:
- `pointerdown`: `send(cur.x, true)` (rage keydown). Start a 500ms timer.
  If it fires while still held: `send(cur.x, false)` (release rage),
  `send(cur.xLong, true)` then next-frame `send(cur.xLong, false)` (barrier
  is a tap, not a hold — `boss-scal.js:1682-1690` reads a single keydown).
- `pointerup` before timer fires: clear timer, `send(cur.x, false)`
  (rage keyup). Rage is a single keydown→keyup (`boss-scal.js:1666-1677`),
  so a quick tap = one rage activation.
- Clear the timer in `up()` and on `pointercancel`/`pointerleave`.
- `releaseAll()` must clear any pending long-press timer (add to the
  `killRepeat`/`clearStick` cleanup path or a new `killLong`).

**1c Labels:** `sync()` (`:372-376`) sets `btnA.textContent = p.aLabel`
and `btnX.textContent = p.xLabel`. For `scal`, A shows "strike", X shows
"rage" (the long-press barrier is discovered by holding — add a one-line
hint in the fight's existing hint element, `boss-scal.js:1715` area:
extend the hint substrings rather than replace, since
`tests/fixes18.mjs:210` regex-matches them).

`css/style.css`
- No layout change needed (still 3 buttons). Verify `.tpad__b--x` ≥44px
  and the gap to A/B is ≥8px at 390×844 and `max-height:480px` (`:1923-1929`).
  If tight, nudge `min-width`/`min-height` in the landscape media query.

`tests/fixes8.mjs` / `tests/fixes18.mjs`
- The `scal` touch profile test (wherever it asserts the profile shape)
  → update: `a` is now `'f'` with `aHold`, `x` is `'z'` with `xLong:'x'`,
  no `xHold`/`Shift`.
- Add: drive the pad's A button down, advance time, release → assert
  `startCharge` was called (keydown `f`) and `tryHit` on keyup. Drive X
  tap → assert `z` keydown/keyup (rage). Drive X hold 600ms → assert `x`
  keydown/keyup (barrier) and that `z` was released first.
- `fixes18.mjs:210` hint substrings — extend with "hold f to charge" and
  "hold rage for barrier", don't replace the existing four.

`browser-uat` (after `verify` green):
- 390×844, dpr3, touch+coarse. F8 dev entry to the fight.
- Tap A → charge indicator appears; release → bolt fires.
- Tap X → rage activates (`* rage. everything strikes twice.`).
- Hold X 600ms → barrier blooms (`* the barrier blooms...`).
- Tap B → confirm-exit dialog; tap B again to decline.
- `list_console_messages` → zero runtime errors.

### Phase 2 — Dialogue/cutscene pad behavior (G2)

No expected code change. `browser-uat` verification only:
- 390×844 touch. Warp to a V3 hint sign, tap the pad's A (maps `e` → talk)
  to open the box. Then **tap the dialogue box itself** to advance through
  all lines. Confirm each tap fires `click` (sans advances on click).
- If the tap does not advance (some engines don't synthesize `click` from
  a `touchend` without a `click` handler on the path), add a visible
  "next" button to `touch.js`'s `talking()` branch that maps to `Enter`
  (sans also advances on Enter). Low priority — only if UAT fails.

### Phase 3 — Act I-III intro cube on phone (G3)

No expected code change. `browser-uat` verification:
- 390×844. Drag the cube with a real touch → spins, springs back to front.
- Tap the door → `NEU.tryDoor()` fires (enters the game).
- Tap the cube body → squash animation.
- Screenshot the rest pose. If the cube clips the edges at 390px, lower
  the narrow-screen fov (`scene.js:368`, `44` → `40`) or pull the camera
  (`scene.js:360`, `1.22` → `1.3`).

### Phase 4 — Deck launcher + settings on phone (G4, G5)

`js/core/touch.js`
- `deck` profile (`:87-89`): remove `x: 'Tab'` and `repeat: true`. Keep
  `a: 'Enter'` (launch), `b: 'Escape'`, `stick: true`. Play/Quit are real
  `click` buttons — a thumb taps them directly; `Tab` on mobile escapes
  to the browser chrome.
  ```js
  { id: 'deck', on: function () { return NEU.deck && NEU.deck.running; },
    a: 'Enter', aLabel: 'play', b: 'Escape', stick: true }
  ```

`css/style.css`
- `.sett__rng` thumb (`:1770-1779`): ensure ≥28px thumb and ≥44px track
  height for touch dragging. Check the gear button (`.sett__btn`) is ≥44px.
- Verify `.sett__sw` switch (`:1738-1753`) is ≥44px tap target.

`tests/fixes18.mjs`
- The deck `Tab` trap assertion → update: the pad no longer sends `Tab`;
  focus still traps via the native handler in `deck.js:329-341` (unchanged).

`browser-uat`:
- Open settings via gear tap → toggle a switch by tap → drag the music
  slider → close via X. All work with a thumb.
- Open deck → tap Play → tap Quit. No focus escape to chrome.

### Phase 5 — Page chrome & lights on phone (G6)

No expected code change. `browser-uat` verification:
- 390×844. On the landing page (before boot), tap the lights toggle →
  first-tap dud animation, second tap → lights on + cat.
- After entering the game, confirm the in-scene lights control is tappable
  and nothing is permanently obscured by the fixed canvas.

### Phase 6 — Hear the soundtrack + full phone playthrough (G7, G8)

`browser-uat` only (per its SKILL.md). No source changes.

**6a Sound — render the soundtrack to numbers:**
- Via `evaluate_script`, render each of the 8 tracks through an
  `OfflineAudioContext`. Return peak / RMS / spectral centroid per track.
  Gates: silence (peak ≈ 0), clipping (peak ≈ 1), dead layer (one band
  dominates to the exclusion of the rest).
- Render one WAV of the castle track for a human to judge "is it any good"
  (the only subjective part).

**6b Full phone playthrough:**
- 390×844, dpr3, touch+coarse. Real input only (the engine ignores
  synthetic arrow events — `browser-uat` SKILL.md note).
- Drive Acts I→IV: solve b2/b4/b5/b6 puzzles, open the Calamitas fight,
  **win it via the new phone pad** (Phase 1), exit clean.
- `list_console_messages` → zero runtime errors throughout.
- This is the gate that says "phone works." Everything before it is
  jsdom + targeted UAT; this is the end-to-end proof.

## Test impact

Assertions encoding old behaviour are updated WITH the change:

- `tests/fixes18.mjs` — the `scal` touch profile shape and the deck `Tab`
  mapping both change. Update the profile-shape assertions and the deck
  trap assertion behaviorally (not regex-on-source).
- `tests/fixes8.mjs` — if any test drives the `scal` fight through the
  pad's old `Enter`/`Shift` mapping, rewrite to `f`/`z`/`x` via the new
  `aHold`/`xLong` paths.
- `tests/fixes18.mjs:210` — four hint substrings; extend, don't replace.
- New coverage owed: A held charges (keydown `f` stays down, keyup fires
  `tryHit`); X tap fires `z` (rage); X hold 600ms fires `x` (barrier) and
  releases `z` first; deck pad no longer sends `Tab`.

Known-red pre-existing (do not chase): fixes12 "no unexpected switches
(6)", fixes16 "music.js under 24 KB".

## Verification

```bash
npm install jsdom --prefix tests        # once per session, timeout 300000
for f in js/**/*.js; do node --check "$f" || echo "SYNTAX FAIL $f"; done
node tests/run-all.mjs                  # 15 suites, timeout 300000
```

Every shell command carries an explicit timeout. When a test fails,
suspect the harness first (see `verify` SKILL.md traps: runScripts
outside-only, non-null 2d context stub, real getBoundingClientRect, hand-
driven IntersectionObserver, warp before E, anchor CSS selectors to line
start). jsdom-unprovable parts go through `browser-uat` afterwards.

## Execution order

Phases 1-5 are independent → separate builder waves (per AGENTS.md
protocol: builder writes failing test → green → verifier runs `verify`
→ reviewer SHIP/REJECT). Phase 6 runs **last** because it exercises the
Phase 1 pad in a full run.

| Phase | Touches files | Verify with | Blocks next? |
|---|---|---|---|
| 1 (Calamitas pad) | `touch.js`, `style.css`, `fixes8.mjs`, `fixes18.mjs` | `verify` → `browser-uat` | No |
| 2 (Dialogue) | none expected | `browser-uat` | No |
| 3 (Intro cube) | none expected | `browser-uat` | No |
| 4 (Deck/settings) | `touch.js`, `style.css`, `fixes18.mjs` | `verify` → `browser-uat` | No |
| 5 (Page chrome) | none expected | `browser-uat` | No |
| 6 (Sound + full run) | none | `browser-uat` | No — final gate |

## Flagged out of scope

- A 4th pad button (rejected by user; hold-A to charge chosen instead).
- Focus `Shift` in the Calamitas fight (dropped by user's choice).
- Sprite re-gathering for Undertale/Deltarune/Terraria (blocked on a
  local game install — `BUG Tracker.md:87-91`).
- Post-hearts phase-2 feel beyond jsdom (covered by Phase 6b playthrough).
