# neu — implementation plan and agent handoff

**One document. Everything an agent needs to pick this up cold and finish it.**

Written 2026-08-16. Supersedes `pending.md` as the working list; `pending.md`
stays as the short version.

---

# PART ONE — CONTEXT

Read this whole part before touching a file. It is here so you do not have to
re-derive anything.

## 1.1 What this is

A personal website for **Neu** (`neudron.troll@gmail.com`) at
**https://www.neu.ac** that is secretly a three-hour game.

It opens as a black pixel-art portfolio with a rotating 3D glass cube. Hidden
behind the contact section is a four-act chain: a sword errand, a blackout, a
console, and a 31-room adventure with three boss fights, a quiz, a rhythm game
and a crafting grid.

**Read `memory/story.md` before designing anything.** It is the full narrative
and the reasoning behind every beat. You will make worse decisions without it.

**Tone: black goth-cute, 6/10 toward cute.** Goth lives in the colour and the
material; cute lives in the motion and the silhouette. Nothing decorative
carries the cute — no bows, no charms. Rounded corners, generous air, easing
that overshoots.

## 1.2 Where everything is

```
Documents\neu\
  site\                 ← THE PROJECT. everything lives here.
    index.html
    css\style.css       ~1600 lines, one file
    js\
      core\   quest save juice danmaku engine
              music perf settings touch dev
      page\   main stars scene
      game\   sword sans bullet dark deck
      act4\   act4 rooms-a rooms-d rooms-g boss-scal
              boss-polt quiz rhythm craft crack
      data\   data sheets
    img\      + img\act4\{calamity,deltarune,terraria,undertale}
    audio\    + audio\act4\
    fonts\webfonts\     31 files, self-hosted Undertale kit
    memory\   ← ALL DOCUMENTATION. read it.
    tests\    fixes5..fixes17.mjs + playthrough.mjs
              (node_modules is gitignored — 13 MB of jsdom)
    .github\workflows\deploy.yml
    CNAME     www.neu.ac
  _deploy\    git clone of Neudron/Neudron.github.io — push from HERE
  _scripts\   one-off sprite-scraping scripts. not part of the site.
  _removed-from-main\
```

`site\` and `_deploy\` must be kept identical. `site\` is where you work.

## 1.3 The memory files

| File | What |
|---|---|
| `CLAUDE.md` | working memory, the hard rules |
| `memory/story.md` | **the whole game, start to finish** |
| `memory/architecture.md` | modules, load order, z-index ladder, patterns |
| `memory/design.md` | colour, type, motion, accessibility floor |
| `memory/chain.md` | the 45-objective chain, mechanics, voices |
| `memory/decisions.md` | **rejected approaches — read before re-proposing one** |
| `memory/workflow.md` | deploy, DNS, jsdom traps |
| `memory/assets.md` | every sprite and sound, and where it came from |
| `memory/plan-act4.md` | the Act IV design doc |
| `memory/pending.md` | short version of Part Two below |

## 1.4 Hard rules — these override your defaults

1. **NEVER commit or push unless asked in that message.** Pages deploys from a
   GitHub Actions workflow, so any push to `main` is live in under a minute.
   There is no staging step. Building and testing locally is always fine.
2. **No build step. Ever.** No npm, no bundler, no framework, no transpile.
   Plain `<script>` tags. Three.js arrives via `<script type="importmap">` from
   jsDelivr. If a fix needs tooling, it is the wrong fix.
3. **ES5-style syntax in `js/`.** `var`, function declarations, no arrow
   functions, no optional chaining, no `const`/`let`. The test harness may use
   modern syntax; the shipped site may not.
4. **Font sizes are multiples of 16px.** The Undertale faces are drawn on a
   16px grid; 15px resamples the bitmap and destroys the typeface. Never
   `clamp()` a font-size. 16, 32, 48, 96.
5. **Use the existing sprites.** Do not generate replacements unless asked.
6. **Single source of truth.** Progress lives ONLY in `core/quest.js`; world
   state ONLY in `core/save.js`. The one time a module kept its own copy
   (`dark.js` holding `through`/`fixed`) it produced an unfinishable dead end.
7. **`.tbox` is z-index 96 and stays the top layer.** Anything new goes below.

## 1.5 Architecture in sixty seconds

Every module is an IIFE hanging its surface off one global, `NEU`, and guards
its own DOM lookups so a missing element degrades to a no-op.

**Load order matters** and is enforced by the order of `<script>` tags:

```
core/quest.js   FIRST — everything reports progress into it
core/save.js    mirrors quest
core/juice.js   feedback; every scene calls into it
core/danmaku.js shared bullet-hell layer (soul, arena, shots, death)
data/sheets.js  the sprite manifest
core/engine.js  rooms (also exports drawPlayer for dark.js)
page/* game/* act4/*
core/music.js   the soundtrack — polls every scene for which is running,
                and settings.js reads its volume when the panel is built
core/perf.js    the frame-time meter; samples nothing until dev asks
core/settings.js  the accessibility panel (needs juice + save + music)
core/touch.js   thumb controls — polls every scene for which is running
core/dev.js     LAST — needs everything else present
```

"Last" means the last **classic** script. `page/scene.js` is a `type="module"`
and therefore deferred until after parsing, so it sits below `dev.js` in the
file without running before it.

**The z-index ladder.** Keep it updated; burying the dialogue box was a real
reported bug caused by not having it written down:

```
30 .ctl · 39 blackout scrim · 40 .sleep .tv .dog .sett__btn · 42 .sword .quest__t
43 .keyobj .quest · 44 .swcue · 46 .pethand · 50 .boot · 55 .panel
70 .bh .dk .eng · 74 .chips · 76 .quiz .fnf .craft .polt · 78 .deck
80 .dev · 84 .fps · 88 .sheetbox · 90 .swfly · 92 .tpad · 94 .sett · 96 .tbox
```

`.tpad` (thumb controls) hides entirely while `.tbox` is up rather than
sitting under it — the box is modal, tapping it advances it, and two
competing targets on a phone is how you mis-tap.

**Key APIs:**

```js
NEU.quest.mark(id) / .bump(id,n) / .add(step,group) / .lock(on) / .replay(ids)
NEU.save.flag(k,v) / .flagged(k) / .give(i) / .has(i) / .best(game,score)
NEU.juice.hit(tier) / .frozen() / .begin(ctx,w,h) / .end(ctx,shook) / .burst()
NEU.juice.setNoShake(on) / .setNoFlash(on)     // in-game settings
NEU.danmaku.arena(w,h) / .soul.draw(ctx,x,y,inv) / .shot(list,…) / .death(ctx,…)
NEU.engine.register(id,def) / .tileset(n,def) / .enter(id,spawn) / .api
NEU.engine.zone()             // the current room's tileset — music keys off it
NEU.music.play(zone) / .stop() / .setVolume(0..100) / .track / .intensity
NEU.engine.drawPlayer(ctx, x, y, face, walked, moving, anchorFeet, scale)
NEU.talk(lines, who)          // who: 'sans' | 'narr' | 'dog' | 'tv'
```

## 1.6 How to run and test

```
cd Documents\neu\site\tests
node fixes5.mjs    # sleep timing, dock, voices, replay regression   (50)
node fixes6.mjs    # z-order, carried console, the deck              (48)
node fixes7.mjs    # save, engine, endless, sprite manifest, weight  (70)
node fixes8.mjs    # zones A/B, puzzle solvability, Calamitas        (49)
node fixes9.mjs    # zones D/E, the merchant, Tenna's quiz           (53)
node fixes10.mjs   # zones G–K, rhythm, crafting, crack, Polterghast (78)
node fixes11.mjs   # the juice layer, organisation, real art         (75)
node fixes12.mjs   # settings panel, boot restore, 3Hz flash audit   (58)
node fixes13.mjs   # Calamitas sheets + six oggs, danmaku seam        (72)
node fixes14.mjs   # the six tilesets, atlas bounds, palette fallback (70)
node fixes15.mjs   # thumb controls, key synthesis, no stuck keys     (99)
node fixes16.mjs   # the soundtrack: gate, crossfade, duck, hidden tab (181)
node fixes17.mjs   # quiz focus, fps, covers, sprites, README, deploy line (260)
node playthrough.mjs # full Act I→IV walkthrough, save round-trips   (45)
```

**1208 checks. All passing as of 2026-08-17.** Run them one at a time —
the whole set exceeds a single tool-call timeout.

Syntax gate first, it is instant and catches most mistakes:
```
for f in js/**/*.js; do node --check "$f" || echo "FAIL $f"; done
```

To view the site: `python -m http.server` from `site\`, then localhost:8000.
Dev console in-page: **Ctrl + Shift + `**

## 1.7 The jsdom harness — required setup

Chrome and puppeteer are blocked. Tests run in jsdom under node against the
real files.

- `new JSDOM(html, { runScripts: 'outside-only' })` — without it `window.eval`
  has no `window` global and every module throws.
- **The 2d context stub must NOT return null.** `engine.js`, `bullet.js`,
  `dark.js`, `deck.js` and both bosses bail out of their entire module if
  `getContext` fails, so a null stub silently removes half the API and the
  failures look like site bugs. Return a Proxy of no-ops.
- `getBoundingClientRect` must return a real box; jsdom's default is zeroes.
- Drive `IntersectionObserver` by hand — it never fires on its own.
- Stub `AudioContext` including `createBufferSource`, `createBiquadFilter`,
  `createBuffer`.

## 1.8 Traps that have produced FALSE FAILURES here

**Check the harness before the site. Most failures in this project have been
test bugs reporting working code as broken.** Eleven so far:

1. **Unanchored CSS selector search.** `CSS.indexOf('.tbox {')` matched the
   phrase quoted inside an explanatory comment. Anchor to `'\n' + sel + ' {'`.
2. **Unbalanced brace capture.** `spawns:\s*\{([^}]*)\}` stops at the brace
   closing the FIRST nested spawn object, so every room with two spawns looked
   broken. Count depth.
3. **Computed values in a literal scan.** `to: 'g_' + n` makes a
   `to:\s*'([a-z0-9_]+)'` scan capture the prefix `g_`. Exclude matches
   followed by `+`.
4. **Regexes matching your own comments.** A `/rotate/` check hit the word
   inside a comment explaining why rotate was removed. A bare
   `indexOf('js/engine.js')` matched a comment above every `<script>`.
5. **Asserting before the code that acts.** Check state after the call.
6. **Warping to the wrong place.** In walk mode use `NEU.dark.warpSw()`, not
   `warp()`, or pressing E silently does nothing.
7. **Frame-loop timing.** `juice.begin()` steps decay with dt clamped to 50ms.
   Two widely-spaced calls look like a stall. Drive it like a real loop.
8. **A scan that finds nothing and passes.** fixes14 §4 looked for `map:` when
   rooms actually store `tiles: [...].join('\n')`. It found zero chars in all
   three files and reported "every terrain char renders" three times, green.
   **Any scan over a collection must first assert the collection is
   non-empty.** A green check on an empty set is worse than a red one.
9. **Flagging the mechanism built to prevent the problem.** fixes14 §5 searched
   every module for `sr-*.png` and hit `NEU.sheetSources` in `data/sheets.js`
   — the manifest that exists precisely so the source atlases can be excluded.
   Strip the allowlist before searching for violations, and separately assert
   the allowlist is still populated.
10. **Asserting adjacency when the rule is order.** fixes12 demanded that
   `deck.js`, `settings.js` and `dev.js` be three consecutive lines. Inserting
   `core/touch.js` between two of them reported a load-order break that had
   not happened. If a check fails when an unrelated file is *added*, it is
   testing the wrong property. Compare `indexOf` positions.
11. **Counting things instead of naming them.** The same suite asserted "three
   switches". Adding a fourth failed with no clue which one, and it would
   equally have passed if someone deleted one and added another. Assert the
   names, then the count.

**And two that were NOT test bugs:**

- `Copy-Item` adds files and never removes them, so syncing `site\` to
  `_deploy\` left deleted files behind and Act IV art sat at 2,284 KB against
  a 500 KB budget. **Always mirror, never copy** — `Remove-Item -Recurse`
  then `Copy-Item -Recurse`. In `rsync` terms: `--delete` alone **protects
  excluded files from deletion**. If the point is to purge something you have
  just started excluding, you need `--delete-excluded`.
- Excludes are the wrong tool for "must never ship" anyway, because they only
  apply to whoever remembers to type them. `site/.gitignore` now carries
  `tests/node_modules/`, `img/act4/deltarune/` and `sr-*.png`, so the rule
  travels with the repo instead of living in one command someone runs by hand.

## 1.9 PowerShell traps

- `-clike` treats `[hidden]` as a wildcard character class → false negatives.
- `-match` is case-insensitive by default.
- `cmd && python <<EOF` — if `cmd` fails the heredoc never runs and the
  silence looks like the edit succeeded.
- `gh` is not on PATH. Verify deploys by fetching the live file with a
  cache-buster, not by querying the Actions API.

## 1.10 Skills — read these first

Four project skills are saved to the account and load automatically:

| Skill | Fires when |
|---|---|
| `neu-site` | any file in the project — house rules, ladder, namespace, tone |
| `neu-room` | adding/editing a room, puzzle, tileset, NPC or boss |
| `neu-verify` | before saying "done"; writing tests; deploying |
| `neu-juice` | an action works but feels weak; adding a hit/pickup/death event |

Adapted from `gamedev-skills/awesome-gamedev-agent-skills` (Apache-2.0) and
`mgechev/skills-best-practices`. **`game-feel` and `camera-systems` were read
in full**; the rest of that repo's 66 skills are for Godot/Unity/Unreal and do
not apply.

**EVALUATED 2026-08-17.** These three had been sitting in this list judged by
their names. They have now actually been read, and two of the three are a
straight no — which is worth writing down so nobody re-proposes them:

| Repo | Verdict |
|---|---|
| `CloudAI-X/threejs-skills` (MIT) | **Maybe, low priority.** ~10 skill files: scene setup, geometry, materials, lighting, textures, animation, loaders, shaders, post-processing, interaction. Aimed at *building* a three.js scene. `page/scene.js` is one finished glass cube on r185 and is not being reworked, so there is nothing here to apply today. Read it if the cube is ever rebuilt. |
| `majidmanzarpour/threejs-game-skills` | **No.** It is built around a **Vite + TypeScript scaffold** and Playwright. Rule 2 forbids a build step outright, and Chrome/puppeteer are blocked here — the two things it hands you are the two things this project cannot accept. |
| `leigest519/OpenGame` | **No.** Not a skill set. It is a whole agentic framework (TypeScript, Docker, its own fine-tuned `GameCoder-27B` model, a Template Skill / Debug Skill loop) for generating games end to end. There is nothing to port into a zero-build vanilla site. |

**One idea worth stealing from the one that was rejected.** `threejs-game-skills`
ships its generated games with *deterministic test hooks and a seeded RNG* so
an agent can bot-playtest its own output. This project has 933 jsdom checks
and no seeded RNG anywhere — `Math.random()` is called directly in the juice
particles, the quiz host lines and several attack patterns. That is why
`playthrough.mjs` can prove the objectives tick but cannot prove a fight is
survivable. A seeded RNG behind `NEU.rand()` would be a small change with a
large payoff. Not done; recorded here so it is not lost.

- `gamedev-skills` disciplines not yet pulled: `camera-systems` (partially
  used), `performance-optimization`, `input-systems`, `audio-design`,
  `game-ui-ux`, `level-design`, `puzzle`

Fetch a `SKILL.md` with `raw.githubusercontent.com/<repo>/main/skills/<path>`.
GitHub raw fetches work; binary downloads do not.

---

# PART TWO — EVERYTHING OUTSTANDING

Nineteen items. Ranked by what breaks if ignored.

## Tier 0 — needs Neu, not an agent

| # | Item | Note |
|---|---|---|
| 0.1 | **Deploy permission** | Acts I–IV are all local; live site is on the pre-Act-IV commit `f6acc9d` |
| 0.2 | **Confirm 5 provisional frame counts** | `sheet fireblast/gigablast/heart/sepulcher/hook` in the dev console. Two minutes |
| 0.3 | **Verify Catastrophe slash orientation** | `slashTop`/`slashBot` in `data/sheets.js` are flagged `verify:'orientation'`. If swapped, swap two `src` strings |
| 0.4 | **PR #1 is still open** | `copilot/link-neuac-domain` holds an old 70-byte page; merging overwrites the site |
| 0.5 | **Enforce HTTPS unticked** | Settings → Pages |

## Tier 1 — structural, gets worse with time

| # | Item |
|---|---|
| ~~1.1~~ | ~~**`game/dark.js` and `game/bullet.js` are a second engine.**~~ **DONE.** `danmaku.js` extracted; `dark.js` character removed (uses `engine.drawPlayer`); `bullet.js`, `boss-scal.js`, `boss-polt.js` all refactored onto `NEU.danmaku`. Walk mode and `sweep`/`blocked`/`solidAt` in `dark.js` still separate (walk mode is not a room). |
| ~~1.2~~ | ~~**No full-playthrough test.**~~ **DONE.** `tests/playthrough.mjs` — 45 checks, Acts I→IV, save round-trips at every boundary. |
| 1.3 | **Accessibility partially addressed.** `craft.js` now has arrow-key grid navigation. `deck.js` traps Tab focus. `juice.js` exposes `setNoShake`/`setNoFlash` for in-game settings. `danmaku.js` dims (not blinks) the soul when reduced/noFlash. **Settings panel now built** (`js/core/settings.js` — shake/flash/larger-text switches, `Ctrl+Shift+,`, gear button, persisted as save flags). **3Hz flash audit done** (measured in fixes12 §7 — fastest loop is the 1s text cursor). **Still TODO: quiz Tab focus audit.** |

## Tier 2 — visible to a player

| # | Item |
|---|---|
| 2.1 | ~~**The forest uses palette colours, not the Deltarune tree crops.**~~ **DONE (Phase 4b).** All six zones draw from `img/act4/tiles/*.png`, 2.1 KB total, tiles scored for opacity/variance/seam then re-toned to the site palette. `colours` kept as the fallback |
| 2.2 | **Seven placeholder sprites**: `dog.svg` `hammer.svg` `clicker.svg` `hand.svg` `blanket.svg` `switch2.svg` `tv.svg` |
| 2.3 | ~~**Calamitas only uses her body sheet.**~~ **DONE.** Darts, hellblasts, fireblasts, gigablasts, fists, slashes, the Sepulcher, the hearts and the won-state ashes all draw from `data/sheets.js` via the `sprite(key,x,y,scale,rot,glow)` helper (rotated to travel), with the coloured-square fallback kept |
| 2.4 | ~~**No touch input anywhere.**~~ **DONE (Phase 6).** `core/touch.js` synthesises real KeyboardEvents from a vector stick and contextual buttons; all nine scenes covered without changing any of them |
| ~~2.5~~ | ~~**No soundtrack.**~~ **DONE (Phase 5b).** `core/music.js` — eight procedural tracks, **zero bytes of audio downloaded**. Zone tracks keyed by tileset name through a new `engine.zone()`; a 250ms poll picks the track so no scene changed; crossfade between zones and no restart within one; ducks under the dialogue box; boss layers arrive as HP falls; the rhythm game is silenced so two tempos never fight. Volume slider in settings, persisted as `opt_music` |
| 2.6 | **The `.deck` shelf has no cover art** — five tiles are two letters on a gradient |

## Tier 3 — quality and hygiene

| # | Item |
|---|---|
| 3.1 | **`loader.js` dropped deliberately.** Boot carries ~30 KB more JS than the "+0 KB" target. Documented in `plan-act4.md` §9 |
| 3.2 | ~~**`css/style.css` is ~1600 lines in one file.**~~ **TOC added** (top of the file, line 11). Splitting it still means a build step, so leave it |
| 3.3 | **No performance budget enforcement.** Nothing measures frame time |
| 3.4 | **`.well-known/discord`** parked in `_removed-from-main` if wanted back |
| 3.5 | **Three skill repos unevaluated** (§1.10) |

---

# PART THREE — THE PLAN

> **STATUS 2026-08-16, verified by running every suite and grepping source:**
> **Phases 1, 2 and 3 are DONE, and so are 4a and 5a.** `core/danmaku.js`
> exists and all three fights use it; `dark.js` no longer carries its own
> sprite arrays or collision; `core/settings.js` ships all three switches
> (`noShake`/`noFlash`/**larger text**); `css/style.css` has its TOC;
> `tests/playthrough.mjs` walks Act I → IV. **752 checks green across 12
> suites** (fixes13 — Calamitas's sheets and sounds; fixes14 — the tilesets;
> fixes15 — thumb controls).
>
> **UPDATE 2026-08-17: Phase 5b is DONE.** `core/music.js` gives Act IV a
> soundtrack that downloads nothing — see Phase 5b below. **933 checks green
> across 13 suites** (fixes16 — the music layer, 181). Phase 4b (tilesets) and
> Phase 6 (touch) were already done. The verifier's "3.1 no larger text" and
> "3.3 no CSS TOC" rows were wrong — both already shipped; corrected in
> `pending.md`. 3.6 (`bullet.js` local `IFRAMES`) is closed.
>
> **Start at Phase 7 (polish and ship).** The two real gaps left are the
> seven placeholder sprites (4c) and the deck cover art (4d), both of which
> need art decisions from Neu, plus the fps meter and the README. **The most
> valuable single thing left is a manual playthrough on a real phone** — every
> check in this project is jsdom, and nobody has heard the soundtrack out loud
> or held the thumb pad.
>
> Calamitas draws everything from her sheets through a shared
> `sprite(key,x,y,scale,rot,glow)` helper with a kept coloured-square
> fallback, and the six `audio/act4/*.ogg` files play through the pooled
> pattern from `sans.js`.
>
> **Before anything is deployed:** `_deploy\` has lost its `.git` and has to be
> re-cloned. See `pending.md` 1.6.

Seven phases. **Do them in order.** Each ends with a passing test run and a
`pending.md` update. Estimates assume the agent has read Part One.

---

## PHASE 1 — the engine port ✅
**Tier 1.1 · COMPLETE**

Two implementations of movement is how this codebase rots. `core/engine.js`
already has swept collision, a camera with a dead zone, entities, triggers and
the distance-driven walk cycle. `dark.js` and `bullet.js` each had their own.

### 1a. Extract the danmaku layer ✅

`bullet.js`, `boss-scal.js` and `boss-polt.js` each reimplemented: the arena
rect, the soul sprite, i-frames with flashing, shift-to-focus, the death
animation with heart shards, and the bullet array with cull bounds.

Created **`js/core/danmaku.js`**:

```js
NEU.danmaku = {
  arena(w, h),                    // returns {AX, AY, AW, AH}, resize-aware
  soul: { draw(ctx,x,y,inv), R: 3.2, stamp(ctx,rows,cx,cy,s,col), COL },
  shot(list, x,y,vx,vy,r,colour,kind,maxCap),
  step(list, dt, bounds),         // move + cull, returns survivors
  hits(list, px, py, r),          // returns the bullet that hit, or null
  death(ctx, px, py, sinceMs, col), // the shatter, returns true while playing
  resetDeath(),                   // call before starting a new death
  IFRAMES: 1.1, SPEED: 250, FOCUS: 108
};
```

All three consumers rewritten to use it. **Behaviour unchanged** — all
existing suites pass.

- [x] `core/danmaku.js` exists and is loaded before `game/bullet.js`
- [x] `bullet.js`, `boss-scal.js`, `boss-polt.js` contain no local `HEART`
      array, no local i-frame constant, no local death-shatter loop
- [x] fixes5–11 all still pass unchanged
- [ ] a new fixes12 §1 asserts all three use `NEU.danmaku` *(deferred — all
      suites green, assertion easy to add)*

### 1b. Port `dark.js` onto the engine ✅

- `dark.js` character sprite arrays (`BODY_DOWN`, `BODY_UP`, `BODY_LEFT`,
  `LEGS`, `PAL`, `mirror`, `stamp`) **removed entirely**.
- `dark.js` now calls `NEU.engine.drawPlayer(ctx, sx, sy, face, walked,
  moving, false, 2)` — the engine is the single source of the character
  sprite.
- `engine.js` exports a new `drawPlayer(targetCtx, sx, sy, face, walked,
  moving, anchorFeet, scale)` function on `NEU.engine`.
- **Walk mode stays special-cased** — it draws onto the real page, targets
  the live `#lightsToggle`, and is not a room. Correct per plan.
- `sweep`/`blocked`/`solidAt` remain in `dark.js` — walk mode is not an
  engine room and needs its own collision against the DOM.
- Endless mode still works (no grey door, torch shrinks).

- [x] `dark.js` has no `BODY_DOWN`/`BODY_UP`/`BODY_LEFT`/`LEGS` arrays
- [x] `dark.js` has no local `stamp` function
- [x] fixes5 §"the hammer loop still runs twice" passes
- [x] the deck's endless "the dark" still records a distance best

### 1c. Port `bullet.js`'s arena ✅

`bullet.js` now uses `NEU.danmaku` for arena sizing, shot creation, soul
rendering, and death animation. No separate port needed beyond 1a.

### Risks
`dark.js` walk mode is the fiddliest code in the project and the replay loop
runs through it. **fixes5 run in full — 50/50 pass.**

---

## PHASE 2 — the full playthrough ✅
**Tier 1.2 · COMPLETE**

Wrote **`tests/playthrough.mjs`**: one scripted run from a blank save to
`a4_end`, asserting all 38 objectives tick in order (16 Acts I–III + 22
Act IV) and that save state round-trips cleanly at every act boundary.

- [x] every objective ticks
- [x] **the run is repeated with a serialise→wipe→restore at each act
      boundary** and produces identical final state
- [x] runs in under 5 seconds
- [x] **45 checks, all passing**

**This is the single highest-value test in the project.** It is the only thing
that can catch a cross-act regression.

---

## PHASE 3 — accessibility (COMPLETE)
**Tier 1.3 · DONE 2026-08-16**

The site promises WCAG AA in both themes. The Act IV scenes were never
verified against that promise. **Now closed out: panel UI, persistence,
boot restore, and the measured flash audit.**

### 3a. Keyboard-only paths (DONE)
- **quiz** — A/B/C/D and 1/2/3/4 already bound. *(Tab focus audit still
  open — the only unchecked item left in this phase.)*
- **craft** — ✅ Arrow-key navigation between cells, Space/Enter to
  place/take. Focus wraps within the 3×3 grid. Auto-focuses on open.
- **deck** — ✅ Tab focus trapped within the overlay. Arrows/Enter already bound.
- **rhythm** — arrows only, fine.
- **rooms** — arrows/WASD/E/R, fine.
- **settings** — ✅ NEW. Tab trapped within the panel, Space/Enter on the
  switches, Escape closes, focus returns to the gear.

### 3b. Flash safety (DONE — measured, not assumed)
`tests/fixes12.mjs` §7 scans every `infinite` animation in the
stylesheet and asserts the cycle time ≥ 0.333s (3Hz). Results: the
fastest loop is `tblink` at 1s — the text cursor. `is-trip` is a static
filter (no animation). `crackSpin` is a 4s rotation, not a luminance
flash. `juice.overlay` is a 50–100ms one-shot, and one-shots are events,
not loops, so they are exempt.

### 3c. A settings panel (DONE)
Built `js/core/settings.js`, loaded after `deck.js`, before `dev.js`:

- **Three switches** — reduce screen shake, reduce flashing, larger
  text — `role="switch"` buttons, focusable, Tab-trapped.
- **Opens** on `Ctrl+Shift+,` and from a gear button (inline SVG, top
  right below the lights toggle), and from dev console `set`.
- **Persists** as save flags `opt_noShake` / `opt_noFlash` /
  `opt_largeText` — one file, same as everything else.
- **Larger text is a zoom, not a font-size** (`html.text-lg { zoom: 1.25 }`)
  — resampling a single Undertale face would blur it; scaling the whole
  page keeps the 16px grid intact.
- **prefers-reduced-motion** forces shake+flash ON, disables their
  switches, and shows a note explaining why.
- **z-index 94** — below the dialogue box (96), above everything else.

### 3d. THE BOOT-RESTORE FIX (new, found while doing 3c)
The save file was written constantly but **never read back**: nothing
called `NEU.save.load()`/`apply()`, `act4.js`'s resume logic read
`mem.room`, and `mem` started blank on every load — so closing the tab
quietly ended the game and no preference could survive a reload.
`save.js` now restores the file at load time (migrated, then flushed
back). fixes12 §5 seeds a file and asserts the whole thing comes back.

- [x] craft navigable by keyboard (arrow keys + space/enter)
- [x] deck traps Tab focus
- [x] juice exposes manual shake/flash toggles
- [x] danmaku soul dims instead of blinks when reduced
- [ ] quiz Tab focus audit
- [x] no animation exceeds 3Hz, measured not assumed
- [x] settings panel UI built
- [x] the settings persist in the save file
- [x] `prefers-reduced-motion` still forces all three on

---

## PHASE 4 — the art
**Tier 2.1, 2.2, 2.3, 2.6 · 4a done, 4b next**

### 4a. Calamitas's projectiles ✅ DONE
Her body already uses `data/sheets.js`. Everything she throws now does too —
`dart`, `hellblast`, `fireblast`, `gigablast`, `fist`, `slashTop`, `sepulcher`,
`heart`, `ashes`, plus `scal`/`scalHood` for her body.

Built on the `sprite(key, x, y, scale, rot, glow)` helper (the `drawSheet`
pattern from `boss-polt.js`, plus rotation and a `glow` flag for phase 2).
**The coloured-square fallback is kept** — a silently absent sprite gets
mistaken for a logic bug.

Projectiles rotate to face travel: `ctx.rotate(Math.atan2(vy, vx))`. The
brothers rotate to the player. The won-state drop draws `ashes`. Verified by
`fixes13` §2; `fixes8` (49 checks) still passes over the rewritten draw path.

### 4b. The forest tilesets — ✅ DONE
All six zones (`woods castle city home prize storm`) draw real art from
`img/act4/tiles/<zone>.png`. **2.1 KB of tile sheets total.**

**How the tiles were chosen.** Not by eye — the atlases are large and mostly
unusable. A scoring pass measured every 16×16 block in each source for three
things:
1. **fully opaque** (alpha ≥ 250 everywhere) — a tile with holes shows the
   background through the floor
2. **interior variance > 12** — rejects flat colour, which is what the palette
   fallback already does better
3. **seam cost** — left edge vs right edge, top vs bottom. A tile that repeats
   across a whole room has to meet itself without a visible line. Every
   shipped tile scored **seam 0**.

Then each winner was flattened to luminance and re-mapped onto a ramp built
from **the colour that char already had in `colours`**. Raw Deltarune tiles
are far brighter and warmer than this page; pasting them in unmodified makes
the woods read as a screenshot of a different game. Texture from them, tone
from us. The compression is deliberate (`k = 0.55 + k*0.75`) so nothing gets
light enough to fight the dialogue box.

`colours` is kept everywhere and **must not be deleted** — it is what renders
if a sheet 404s, and fixes14 §3 asserts every char with art also has a colour
behind it.

**Two bugs this turned up**, both invisible until something asserted against
the real files:
- `A`, the altar plinth in `b7_altar`, had no colour in any tileset. It was
  falling through engine.js's generic floor fill, so three of the plinth's
  four cells rendered as floor — a hole in the middle of the room. It has a
  tile and a colour now.
- The deploy folder was staged to ship **13 MB of `tests/node_modules`** and
  **2.5 MB of source atlases**. `site/.gitignore` now covers both. A fresh
  clone ships **1.8 MB**.

**Do not deploy the source atlases.** `NEU.sheetSources` lists all 14; fixes7
asserts none of them ship and fixes14 §5 asserts no shipped module names one
(taking care to exclude the manifest itself, which names them on purpose).

`engine.tilesets()` was added as a read-only accessor so fixes14 can assert
all six carry `src` + `rects` **at runtime** rather than only in source text.

### 4c. The seven placeholders
`dog` `hammer` `clicker` `hand` `blanket` `switch2` `tv`. Either Neu supplies
art or draw originals in the existing pixel style. Ask before drawing.

### 4d. Deck cover art
Five tiles are two letters on a gradient. Draw six small covers (the woods
already has a sigil). Inline SVG, like the sigil — no requests, scales with
the tile.

- [x] no scene draws a coloured rectangle where a sheet exists
- [x] every `sheet` key referenced resolves to a file on disk (fixes7 + fixes13 assert)
- [x] shipped Act IV art stays **under 500 KB** (fixes7 asserts — currently 264 KB)
- [x] palette fallback still renders if art is deleted (fixes14 §3 asserts every
      char with art has a colour behind it; fixes14 §6 asserts the engine's
      `usable` gate and its `fillRect` else-branch both still exist)
- [x] every terrain char has a **chosen** look, not the generic fill (fixes14 §4
      — the check that caught the altar plinth)
- [x] no `sr-*` source atlas is named by any shipped module (fixes14 §5)

---

## PHASE 5 — sound
**Tier 2.5 · 5a done, 5b next**

Everything else is synthesised or silent. Six real Calamity `.ogg` files sat
unused in `audio/act4/`.

### 5a. Wire the six ✅ DONE
`hellblast` `fireblast` `fireblast-hit` `giga` `giga-hit` `maelstrom` → the
matching Calamitas attacks, via the pooled-`Audio` pattern from `sans.js` —
**four copies of the same file**, volume 0.5, preload auto, pools built in
`open()` so the first attack never waits. Each attack family plays its own
charge; the ring burst plays `giga-hit`/`fireblast-hit` by kind. Construction
and play are both try/catch-guarded (no `Audio` in jsdom). Verified by
`fixes13` §3.

### 5b. Adaptive music ✅ DONE
**`js/core/music.js`, `tests/fixes16.mjs` (181 checks)**

Eight tracks — `woods castle city home prize storm` plus one each for
Calamitas and Polterghast — and **not one byte of audio is downloaded**.

**Why synthesised, argued rather than assumed.** Eight zones at two minutes
each, at a polite 96 kbps, is about ten megabytes. This site is opened on a
phone, on data, and Act IV sits three hours into the chain; nobody waits
through a download to hear a forest. The module is 24 KB of javascript that
gzips to roughly four. The better reason is the second one: a recorded loop
cannot answer the game, and this one does.

**It polls; it is never called.** Exactly the shape Phase 6 turned out to
need. A 250ms tick asks which scene is running and, in a room, asks the engine
which tileset it is standing on. **No scene file was changed to add music.**

**The tileset name IS the track name**, read through a new one-line
`NEU.engine.zone()`. A room-id → zone map inside `music.js` would have been a
second source of truth and would drift the first time a room was re-skinned.
fixes16 §4 asserts every registered tileset has a track, so adding a zone
without music fails loudly instead of going quiet.

**Timing comes from `AudioContext.currentTime`**, same rule as `rhythm.js`.
The interval only decides *when to schedule*; every note carries an exact
context time. Patterns are sixteen-character strings — one bar, one character
per 16th note — because a bar of music should be legible as a bar of music.

- [x] one synthesised loop per zone
- [x] crossfade on zone change (1.1s), and **no restart between two rooms of
      the same zone** — the bug that reads as "the loop is too short"
- [x] ducked under dialogue: it reads `#tbox`, so `sans.js` stays the single
      source of truth about whether anyone is talking
- [x] layers arrive as boss HP drops. Neither boss exposes max HP and neither
      needs to — both reset to full in `open()`, so the first reading after a
      fight starts IS the maximum. Re-taken per fight
- [x] the rhythm game is **explicitly silenced**: it is a call-and-response
      chart at its own BPM, and a second tempo under it does not layer, it
      fights
- [x] a mute/volume control exists and persists (`opt_music`, a slider — zero
      IS the mute, so there is one control instead of two that can disagree)
- [x] **nothing autoplays before a user gesture.** The context is not even
      constructed until the first pointerdown/keydown/touchstart; a track
      asked for earlier is remembered and starts when the gesture lands

**Two things fell out of building it**, both real, neither a harness bug:

- The settings Tab trap collected `querySelectorAll('button')`. The moment a
  slider went into the panel, Tab walked straight out of a dialog marked
  `aria-modal` and left the player behind the scrim with no way back to the
  close button. Now `button, input`.
- A lookahead scheduler in a backgrounded tab has teeth: the interval stops
  firing, the audio clock does not, and a naive catch-up queues every missed
  note into the next tenth of a second. It realigns to a bar instead. fixes16
  §10 freezes the clock for four minutes and asserts the next tick stays under
  forty notes with nothing stamped in the past.

**prefers-reduced-motion deliberately does NOT silence this.** That preference
is about vestibular safety, not sound, and reading it as "no audio" takes the
soundtrack away from people who never asked for that. Anyone who wants it gone
has a slider that goes to zero and persists. (`sans.js` does gate its blips on
`reduced`. That is pre-existing and was left alone, but it is arguably the
same mistake and is worth revisiting.)

**Still owed: ears.** Every check here is jsdom against a recording stub. It
proves the schedule, the crossfade and the gate; it proves nothing whatsoever
about whether the castle track is any good. Folded into 3.5, the manual
playthrough.

---

## PHASE 6 — touch ✅ DONE
**Tier 2.4 · `js/core/touch.js`, `tests/fixes15.mjs` (99 checks)**

The plan here was four separate per-scene control schemes. **That was the
wrong shape** and the built version does not follow it.

**What was actually built.** All nine scenes read input identically — a
`keydown`/`keyup` listener on `window` switching on `e.key` — so `touch.js`
changes none of them. It draws one pad and **synthesises real
KeyboardEvents**. Every scene, including any written later, gets touch for
free, and there is exactly one place a key can stick instead of nine.

Per-scene behaviour comes from a profile table instead of per-scene code:

| scene | action | extra | stick |
|---|---|---|---|
| engine | `e` talk | `r` reset | hold |
| scal · polt · bullet | `Enter` | `Shift` focus (held) | hold |
| dark | `e` use | — | hold |
| rhythm | `Enter` | — | hold, no repeat |
| craft · deck | `Enter` | `Tab` (deck) | **auto-repeat** |
| quiz | `Enter` | — | none |

**The details that make it playable, not just present:**
- The stick is a **vector, not four buttons**. Diagonals are the whole point —
  dodging bullets on four-way input is not playable. Dead zone 0.28, diagonal
  threshold 0.38 (deliberately generous).
- **Focus (Shift)** in the three bullet-hell fights only.
- **Auto-repeat on menus only** (340ms delay, 170ms rate, dominant axis).
  Without it, holding left in the crafting grid moves one cell and stalls,
  because a held key only ever fires one keydown. With it on movement you
  would stutter; in the rhythm game it would spam the lane.
- **A key can never stick.** One `releaseAll()`, called from lifted thumb,
  cancelled pointer, pointer leave, window blur, hidden tab, closed scene and
  changed scene. It also kills a running repeat timer — a timer outliving its
  scene is the same bug wearing a different hat.
- **Hidden while the dialogue box is up.** The box is modal and tapping it
  advances it; two competing targets on a phone is how you mis-tap.

**Caught by writing the suite:** a profile sent `z` to `bullet.js`, which only
listens for `Escape` and `Enter`. It read fine and would have done nothing on
a phone. §3 now asserts every profile's action key is one its scene actually
listens for.

- [x] every scene has thumb controls
- [x] hidden on fine pointers unless `settings → thumb controls` says otherwise
- [x] targets ≥ 44px (stick 136, primary 88, others 72)
- [x] `prefers-reduced-motion` honoured
- [x] fixes15 asserts the assumption the whole design rests on — that every
      scene listens on `window` and none checks `isTrusted`
- [ ] **still owed: a real phone.** Every check here is jsdom. See pending 3.5

---

## PHASE 7 — polish and ship
**~1 session**

- [x] `css/style.css` gets a table-of-contents comment block at the top
- [ ] a frame-time meter in the dev console (`fps`), and a documented budget
- [ ] `README.md` rewritten for a stranger — what it is, how to run it
- [ ] full playthrough run once by hand, on desktop and on a phone
- [x] all suites green (576 as of 2026-08-16 — fixes5–13 + playthrough)
- [ ] **ask Neu, then push**

---

# PART FOUR — WORKING AGREEMENT

## Every session

1. Read `CLAUDE.md`, then this file's Part Two.
2. Ask clarifying questions **once, up front**, before building.
3. Create a task list for anything over two steps.
4. Build.
5. `node --check` every touched file.
6. Run the affected suite, plus a new section for new behaviour.
7. **Report honestly.** Say what did NOT get done. If a failure turned out to
   be a harness bug, say so rather than quietly rewriting the assertion.
8. Update `pending.md` and this file's Part Two.
9. **Ask before pushing.**

## Definition of done

A change is done when:
- the syntax gate passes,
- the affected suite passes,
- **any replayable loop has been run twice**,
- a save round-trip has been asserted if state changed,
- `pending.md` reflects reality,
- and the summary says what is still broken.

## Things that are decided — do not re-litigate

From `memory/decisions.md`, with reasons:

- **The boss fight on the TV is gone.** One punchline, hearable once. The deck
  library replaced it.
- **Two text-blip samples was wrong.** Four copies of ONE file.
- **The torch is stepped, not smooth.** Everything else has hard edges.
- **Walk cycles advance on distance, not time.**
- **`rotate(180deg)` and `scaleX(-1)` on the objectives tab were both wrong.**
  `writing-mode: vertical-rl` alone is correct.
- **Rooms are data, not modules.**
- **The deck is DOM, not canvas.** A menu is an interface.
- **Polterghast plays flat.** A free 3D camera makes a bullet pattern
  unreadable.
- **Calamitas's 20-step cycle is fixed and does not reset between phases.**
  Randomising it is easier to write and impossible to master.

## Sizing

| Phase | Sessions |
|---|---|
| 1 engine port | 2 |
| 2 full playthrough | 1 |
| 3 accessibility | 1 |
| 4 art | 3 |
| 5 sound | 2 |
| 6 touch | 2 |
| 7 polish and ship | 1 |
| | **12** |

Phases 1–3 are the ones that matter. 4–6 are visible but optional; the game is
finishable and fun without them. **Phases 1–3 are now done** (one item left:
the quiz Tab focus audit).
