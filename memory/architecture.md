# Architecture

## Zero build

No npm, no bundler, no framework. `index.html` loads plain `<script>` tags in
order. Three.js is the only dependency and it arrives via importmap:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
}}
</script>
```

Every module is an IIFE that hangs its public surface off one global, `NEU`,
and guards its own DOM lookups so a missing element degrades to a no-op rather
than throwing.

## The tree

Reorganised 2026-08-16. The `js/` root holds **only folders** — a flat
directory of twenty modules stopped telling you anything about what depends
on what.

```
js/
  core/   quest save juice engine dev      things everything else needs
          danmaku settings touch music perf
  page/   main stars scene                 the scrolling website itself
  game/   sword sans bullet dark deck      acts I-III
  act4/   act4 rooms-a rooms-d rooms-g     the woods
          boss-scal boss-polt quiz rhythm craft crack shop
  data/   data sheets                      content and manifests
```

Moving a file means updating **three** places, and a stale path is a silent
404 that only shows up later as a missing feature:
1. the `<script src>` in `index.html`
2. every comment in other modules that names the file
3. the `FILES` array and every `read('...')` in `tests/fixes*.mjs`
   — **including regex literals** like `/js\/deck\.js/`, which a
   string-replace pass will miss.

## Load order (matters)

```
core/quest.js   FIRST — everything reports progress into it
core/save.js    mirrors quest; must precede anything that saves
core/juice.js   feedback; every scene calls into it
data/sheets.js  the sprite manifest
core/engine.js  rooms
page/*          the website
game/*          acts I-III
act4/*          the woods
core/music.js   after every scene — it polls them for which is running,
                and before settings.js, which reads its volume
core/settings.js the accessibility panel
core/touch.js   after every scene — it polls them for which is running
core/dev.js     LAST — the dev console needs everything else present
```

Two modules poll instead of being called — `music.js` and `touch.js`. That is
not laziness: scenes open and close from a dozen places and none of them
announces it, so a poll is one contract instead of nine, and it means a scene
written later gets music and thumb controls without being told to.

"Last" means the last **classic** script. `page/scene.js` is a
`type="module"` and therefore deferred until after parsing, so it sits
below `dev.js` in the file without running before it.

`quest.js` is first because it owns the single copy of progress. Scattering
booleans across `sans.js`, `bullet.js` and `dark.js` would let the panel
disagree with the game.

## The `NEU` namespace

State owners, and who reads what:

| Owner | Exposes | Read by |
|---|---|---|
| `quest.js` | `quest.mark/bump/has/lock/replay/reset` | everything |
| `sans.js` | `sfx`, `sans` (state getters), `switchHook`, `grantClicker`, `fitClicker`, `hasClicker`, `hasConsole`, `tvState`, `grantDogFood`, `dev*` | main, bullet, dark, deck |
| `bullet.js` | `bullet`, `charge()`, `devCharge()` | sans, deck |
| `dark.js` | `dark` (open/close/reset/warp/warpSw/interact) | sans, dev |
| `deck.js` | `deck` (open/close/running/sel/title/games) | sans, dev |
| `engine.js` | `engine.zone()` — the current room's **tileset** | music |
| `music.js` | `music.play/stop/setVolume/track/volume/intensity` | settings, dev |

`NEU.switchHook()` is the important one: `main.js` asks it before doing
anything with the Cosmolight, and a `true` return means "handled, don't run the
normal toggle". That is how one control ends up meaning four different things
depending on what you are carrying.

## The z-index ladder

**Keep this list updated.** Burying the dialogue box under the petting hand and
the inside panel was a real reported bug caused by not having this written
down anywhere.

```
  0–3   page content, stage decoration
 30     .ctl        the cosmolight
 39     is-blackout scrim  (below the chips on purpose)
 40     .sleep .tv .dog .sett__btn
 42     .sword .quest__t
 43     .keyobj .quest
 44     .swcue
 46     .pethand
 50     .boot
 55     .panel      "inside"
 70     .bh .dk .eng   full-screen rooms
 74     .chips      ABOVE the rooms — you must see what you carry in them
  76     .quiz .fnf .craft .polt .shop   the act IV scenes
 78     .deck       the console home screen
 80     .dev        the dev console
 84     .fps        the frame-time meter — a readout must never cover
                    the thing being measured, so it sits low
 88     .sheetbox   the sprite inspector
 90     .swfly      the console flying into the dock
 92     .tpad       thumb controls — above every scene, below the box
 94     .sett       the settings panel
 96     .tbox       THE DIALOGUE BOX. Nothing goes above this.
```

This list had drifted by three layers (76, 88 and 94 were all missing)
before the fps meter was added, which is exactly the failure mode the
warning above describes: the ladder is only useful if it is the thing
people update, and it is only updated if someone notices it is wrong.
`memory/PLAN.md` §1.5 carries the same ladder in one-line form — if you
change one, change both.

The pad hides entirely while `.tbox` is up rather than sitting under it.
The box is modal and tapping it advances it; two competing targets on a
phone screen is how you mis-tap.

Rule: a dialogue box is a modal statement. Nothing on this page is ever more
important than the words currently being typed.

## Patterns worth reusing

**`[hidden]` needs a fighting chance.** The UA rule is
`[hidden] { display: none }`, which *any* author rule setting `display`
outranks — `.tbox { display: grid }` beat it and the dialogue was permanently
on screen. Fixed globally with `[hidden] { display: none !important; }`.

**Fixed position + transform only.** Objects with physics (`.sword`,
`.keyobj`, `.swfly`) are `position: fixed; left: 0; top: 0` and moved purely
by `transform`, so JS can hold a document coordinate through a scroll without
ever touching layout.

**Document space vs screen space.** Convert at exactly one boundary in each
direction (`ky - scrollY`). Mixing them is how objects "stick" during scroll.

**Swept collision.** Fast-moving objects test the whole segment travelled
(`segDist`), not the end point, or hard throws tunnel through doors.

**`renderer.setSize(w, h, false)`** — `updateStyle=false` means CSS must size
the canvas. If the canvas has no CSS rule it is invisible, and the symptom
looks like broken camera maths. This cost a whole round once.

**Audio element pools.** A single `Audio` can only play one instance at a
time, so a 42ms-per-character text blip needs four copies of the *same* file.
Four *different* files was the bug — near-identical samples back to back read
as a flam, not as variation.

## Testing

Chrome/puppeteer are blocked in the sandbox. Tests run in **jsdom under node**
against the real files: `tests/fixes*.mjs`.

```
node tests/run-all.mjs        # every suite, hard 60s timeout each
node tests/fixes6.mjs         # or one at a time
```

Required jsdom setup (see `memory/workflow.md` for the traps):
`runScripts: 'outside-only'`, hand-driven `IntersectionObserver`, a stubbed
`AudioContext`, a **non-null** 2d context proxy, and a `getBoundingClientRect`
that returns a real box.
