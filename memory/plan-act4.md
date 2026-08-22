# Act IV — system design and implementation plan

**Final.** Supersedes the draft of earlier today. Assets are in hand and
measured; every number below is real.

Status: **ALL PHASES BUILT.** 31 rooms, 3 fights, quiz, rhythm game, crafting.
**333 checks pass** (fixes5–fixes10). Nothing committed or pushed.

Modules: `engine.js` `save.js` `data/sheets.js` and `act4/{act4,rooms-a,rooms-d,
rooms-g,boss-scal,quiz,rhythm,craft,boss-polt,crack}.js`

Known remaining work is in §10, and it is polish rather than content: the
`dark.js`/`bullet.js` port onto the engine, the five provisional frame counts,
and swapping palette tilesets for the real Deltarune forest crops.

---

## 1. Requirements

### Functional

| # | Requirement |
|---|---|
| F1 | A sixth deck tile with a visually distinct icon opens Act IV |
| F2 | A dark-forest overworld with a path leading to a castle |
| F3 | The Witch asks for help, then turns out to be the boss |
| F4 | Five puzzle rooms, Deltarune-flavoured, all resettable |
| F5 | Supreme Witch, Calamitas fight using **her** attack cycle |
| F6 | Ashes of Annihilation drop → altar in an earlier room → fire door |
| F7 | A city with a merchant; one glowing item is the Recall Potion |
| F8 | New Home corridors → sans, no fight, unlocks breaking the TV |
| F9 | Break the TV with the sword → Tenna → A/B/C/D quiz on five games |
| F10 | Nine ranks D-…S+, each granting its room and all below it |
| F11 | S+ → lightning door → vending machine → punch out Deez Nutz |
| F12 | Hallucination state; gather 5 mushrooms seen across the city |
| F13 | Rap battle for the axe (FNF-style note charts) |
| F14 | Chop mushrooms, craft soup on a 3×3 Minecraft grid |
| F15 | Wake-up scene; dog leaves, sans takes the armchair and the console |
| F16 | Crack in the cube panel → 3 clicks → portal |
| F17 | Polterghast, 3D, all three phases |
| F18 | Thrown home; sans, a hotdog, closing lines |
| F19 | Save/continue across sessions |
| F20 | Deck games run **endless** |

### Non-functional

| # | Requirement | Budget |
|---|---|---|
| N1 | No build step. Plain scripts, importmap only | absolute |
| N2 | 60 fps on a mid-range laptop in every 2D scene | ≥ 55 fps p95 |
| N3 | First paint of the main page unaffected by Act IV | +0 KB at boot |
| N4 | Act IV payload on first entry | ≤ 500 KB |
| N5 | WCAG AA, keyboard-only, `prefers-reduced-motion` | no exceptions |
| N6 | No flashing above 3 Hz | hallucination + lightning door |
| N7 | Save survives a schema change | versioned + migration |
| N8 | Every zone covered by a jsdom suite | 100% of state machines |

### Constraints

- **Solo, session-based development.** Roughly 19 sessions (§8).
- **~35 rooms, 3 bosses.** Act IV is bigger than the whole existing site.
- **Assets are third-party.** Calamity/Deltarune/Terraria/Undertale.
- **Two sprite facts that shape the design**, both discovered by measuring
  the delivered files rather than assumed:
  - Projectiles arrived as **PNG frame strips, not GIFs**. Better — I control
    the playback rate instead of inheriting one.
  - `swc-p1.png` and `swc-p2.png` are **the same file**. The phase-2 look is
    an additive glow over the same body, so phase 2 costs a composite pass,
    not new art.

---

## 2. High-level design

```
                      ┌──────────────────────────────────────┐
   index.html ───────►│  boot (unchanged, 0 KB of act IV)    │
                      └──────────────┬───────────────────────┘
                                     │ deck tile clicked
                                     ▼
                      ┌──────────────────────────────────────┐
                      │  loader.js  — injects js/act4/*      │
                      │  once, on first entry. N3/N4.        │
                      └──────────────┬───────────────────────┘
                                     ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                        engine.js                                │
   │   rooms · tiles · collision · camera · entities · triggers      │
   │   transitions · interaction · walk cycle                        │
   └───┬────────────┬────────────┬────────────┬────────────┬─────────┘
       │            │            │            │            │
       ▼            ▼            ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌────────┐  ┌─────────┐  ┌──────────┐
   │danmaku │  │ puzzle  │  │ quiz   │  │ rhythm  │  │ craft    │
   │ .js    │  │  .js    │  │  .js   │  │  .js    │  │  .js     │
   └───┬────┘  └─────────┘  └────────┘  └─────────┘  └──────────┘
       │  shared arena, soul, i-frames, death anim
       ▼
   ┌──────────────┬──────────────┬───────────────┐
   │ boss-scal.js │ boss-polt.js │ bullet.js     │  (bullet.js ported)
   └──────────────┴──────┬───────┴───────────────┘
                         │ 3D only
                         ▼  reuses scene.js renderer
   ┌─────────────────────────────────────────────────────────────────┐
   │  save.js  ·  quest.js  ·  sheets.js  ·  sans.js (dialogue box)  │
   └─────────────────────────────────────────────────────────────────┘
```

**Data flow.** Everything mutates through `quest.js` and `save.js`; nothing
keeps private progress state. That rule is why the existing chain is
debuggable and it is the single most important thing to preserve at 4× the
size. The replay dead end earlier in this project was caused by exactly one
module (`dark.js`) breaking it.

**Contracts.**

```js
NEU.engine.register(id, roomDef)      // rooms are DATA
NEU.engine.enter(id, spawn)           // fade, swap, spawn, autosave
NEU.engine.give(item) / .has(item)    // routes to the chip tray
NEU.engine.flag(k, v) / .flagged(k)   // world state, saved
NEU.danmaku.run(patternDef)           // returns a promise: win | die | quit
NEU.save.write() / .read() / .wipe()
```

`danmaku.run()` returning a promise is the load-bearing choice: a boss
becomes `await` inside a cutscene script instead of a web of callbacks, and
the three fights stop needing to know anything about what follows them.

---

## 3. Deep dive

### 3.1 Room format

```js
{ id:'b7_altar', tileset:'castle', w:32, h:20,
  tiles:'################\n#..............#\n...',
  entities:[
    {t:'altar',  x:16,y:8,  needs:'ashes', gives:'firedoor'},
    {t:'pickup', x:4, y:14, item:'mushroom_2'},
    {t:'exit',   x:31,y:10, to:'b8_arena_door', spawn:'w'},
    {t:'save',   x:8, y:4}
  ],
  onEnter(c){ if(c.flagged('scal_dead')) c.say(ALTAR_READY,'narr'); } }
```

One char per tile, keyed to a tileset descriptor holding the atlas rect and
the solid flag. Rooms are ~1 KB of text each; 35 rooms is ~35 KB.

### 3.2 Save schema

```js
{ v:1, act:4, room:'b7_altar', spawn:'w',
  flags:{ witch_met:1, scal_dead:1, tv_breakable:0 },
  items:['ashes','recall'],
  quest:{ done:{...}, counts:{...} },
  quiz:{ rank:'B+', score:14 },
  best:{ twenty:94.2, dark:1830 },     // endless scores
  stamp:1786892051210 }
```

Key `neu.save.v1`. Autosave on every room transition and objective tick.
`migrate(from, to)` exists from day one and is a no-op at v1 — adding it
later means the first schema change wipes everyone.

### 3.3 Sprite manifest

Written: **`js/data/sheets.js`**. Terraria stacks frames vertically with a
2px gutter and the frame count lives in the mod's C#, not the file — so it is
measured and recorded once, and no other module knows these numbers.

Measured by alpha-thresholded row scan (alpha > 12; faint antialiasing in the
gutters was welding cells together), then frame height = the smallest divisor
of the sheet height containing every content block.

| sheet | size | frames | cell | confidence |
|---|---|---|---|---|
| SupremeCalamitas | 120×1260 | 21 | 120×60 | high |
| SupremeCalamitasHooded | 120×1302 | 21 | 120×62 | high |
| Polterghast ×3 | 90×1800 | 12 | 90×150 | **confirmed** |
| BrimstoneBarrage (dart) | 18×176 | 4 | 18×44 | **confirmed** |
| BrimstoneHellblast2 | 54×176 | 4 | 54×44 | **confirmed** |
| CataclysmFist ×2 | 126×224 | 4 | 126×56 | **confirmed** |
| CatastropheSlash | 168×240 | 4 | 168×60 | **confirmed** |
| CatastropheSlashAlt | 192×232 | 4 | 192×58 | **confirmed** |
| AshesofAnnihilation | 56×360 | 6 | 56×60 | **confirmed** |
| SCalBrimstoneFireblast | 36×250 | 5 | 36×50 | provisional |
| SCalBrimstoneGigablast | 52×492 | 6 | 52×82 | provisional |
| BrimstoneHeart | 44×370 | 5 | 44×74 | provisional |
| SepulcherHead | 62×88 | 2 | 62×44 | provisional |
| PolterghastHook | 44×88 | 2 | 44×44 | provisional |

Five provisional. Each is the only divisor that is both ≥ the tallest content
block and consistent with its sibling sheets — not a guess, but not proven.
**Phase 0 ships a dev sprite inspector** (`sheet <name>`) that overlays the
cell grid on the image; confirming all five takes under a minute and fixing
one is a one-line edit.

Two more flags from your download report, carried into the code as `verify`
markers: the **Catastrophe top/bottom orientation** is an assumption (in the
mod the Alt fires when `ai[1] == 0`), and if wrong it is a swap of two
strings. And `swc-p1`/`swc-p2` being one file is now a *design* decision, not
a defect — phase 2 is an additive pass.

### 3.4 Asset weight — the one real performance problem

Delivered: **2.9 MB of images**, against a current whole-site payload of
about 400 KB. Shipping that as-is triples the site for a page most visitors
never reach.

| Bucket | Size | Ships? |
|---|---|---|
| Source atlases (Tenna 1.6 MB, Board Games 780 KB, 12 others) | ~2.6 MB | **no** — crops come out of them offline |
| Calamity sprites + Polterghast | ~190 KB | yes, lazily |
| Terraria + Undertale crops | ~6 KB | yes |
| Calamity audio ×6 | 158 KB | yes, lazily |

`NEU.sheetSources` lists the source-only files so a build check can assert
they are absent from the deploy. Act IV then costs **~350 KB, loaded on first
entry, 0 KB at boot** — inside N4.

The duplicate originals in `img/act4/` (both `ashes.png` and
`AshesofAnnihilation.png`, etc.) get pruned in Phase 0. Also: the loose files
at the root of `Downloads\neu-act4\` look like a failed earlier run — a dozen
of them are 236 or 2608 bytes, which is an error page saved with an image
extension. The organised subfolders are the good copy and are what I took.

### 3.5 Boss specs

Both taken from the wikis, not invented.

**Supreme Witch, Calamitas.** Her 20-step attack cycle is fixed and does
*not* reset between phases — that is what makes her learnable and it is the
thing to preserve.

```
1  dart bursts      2  hellblast barrage   3  2× gigablast
5  2× gigablast     6  hellblast barrage   7  dart bursts
9  dart bursts     10  hellblast barrage  11  4× gigablast
12 hellblast       14  dart bursts        15  4× gigablast
17 dart bursts     19  dart bursts        (4,8,13,16,18,20 = charges)
```

- Darts: hovers above you, 8 per burst with even gaps, 3–4 bursts. Some
  bursts randomly become a Fireblast or Gigablast — **the only randomness in
  her entire pattern**, and worth protecting for exactly that reason.
- Fireblast homes, pauses, bursts into a ring of 8–16 darts. Gigablast the
  same but slower, ring of 20–36.
- Hellblasts fire horizontally from beside you, accelerating.

Interludes, invincible throughout: **spawn** (walls down/right/left, then
left+right, then down/left/right; then the Sepulcher + 10 Brimstone Hearts —
kill the hearts to kill it, she is invincible until it dies); **75%** (adds
Fireblasts; up, right, left+right); **50%** (adds Gigablasts; down, left,
left+right); then **the brothers** — Cataclysm right with fists, Catastrophe
left with slashes, each with its own phase 2 at 40%. Both dead → she laughs,
phase 2, faster attacks, half the charges, resumes the cycle where it left
off.

**Polterghast.** P1: alternates slow+6 Phantom Shots / fast+6 Phantom Blasts;
periodically glows red, lines up diagonally, charges once. → 50%. P2: hooks
detach and fire through walls; spreads of 7 Potent shots; charges twice. →
20%. P3: summons a clone (killing it enrages the original); hooks re-chain;
spread of 8 every 7s, 10 if the clone is dead; clone mirrors and charges in
tandem up to 3×, or 4× and faster if dead.

3D notes: body and hooks as instanced meshes, chains as tube segments,
**projectiles as billboarded sprites** so they stay pixel-crisp, and the
camera locked behind the player with movement on a plane. A free 3D camera
makes a bullet pattern unreadable — the same reason the bullet room is
full-screen and not in the panel.

---

## 4. Reliability and failure modes

| Failure | Detection | Response |
|---|---|---|
| Sprite sheet missing | `img.onerror` | draw a magenta cell + log; scene still playable |
| Corrupt save | JSON parse / version check | offer new game, never silently wipe |
| Save quota exceeded | try/catch on `setItem` | warn once, continue in memory |
| WebGL unavailable | context probe | Polterghast falls back to a 2D fight |
| Frame rate collapse | rolling 2s average | drop particle density, then trails |
| Audio blocked | `play()` rejection | synth fallback, already the pattern |

**Monitoring** here means the dev console: `fps`, `save`, `sheet <name>`,
`goto <room>`, `flags`. There is no server to alert.

---

## 5. Trade-offs, explicit

| Decision | Why | Cost |
|---|---|---|
| Room engine over bespoke modules | 35 rooms with one collision implementation instead of 35 | 3 sessions before any Act IV content is visible |
| Port `dark.js` and `bullet.js` onto it | Two engines is how the codebase dies | Risk of regressing working scenes — mitigated by the existing 98 tests |
| Rooms as data strings | Editable without touching logic; ~1 KB each | No visual editor; hand-authoring tilemaps is slow |
| Promise-based bosses | Cutscenes read top to bottom | Async everywhere; needs care with the pause menu |
| localStorage, no server | Zero infrastructure, matches "no build step" | Progress is per-browser; clearing site data wipes it |
| Lazy-load Act IV | Boot stays untouched (N3) | First entry has a ~350 KB pause; needs a loading state |
| Phase 2 as an additive glow | The delivered art made this true anyway | Slight divergence from the wiki crops |
| 2D fallback for Polterghast | Nobody hits a dead end on old hardware | A second implementation of one fight |

**What I'd revisit as it grows:** if Act V ever happens, rooms want a real
editor and the tilemap wants to leave JS. And if the save file gains much
more, it wants compressing — 35 rooms of flags is fine, 200 would not be.

---

## 6. Phases

Each phase is playable end-to-end and tested before the next starts. **Phase
0 must land alone** — everything after it is data on top of it.

| # | Deliverable | Acceptance | Sessions |
|---|---|---|---|
| **0** | `engine.js`, `save.js`, `loader.js`, sprite inspector, `dark.js` + `bullet.js` ported, endless mode, asset prune | All 98 existing tests still pass, unchanged behaviour. Save round-trips. 5 provisional frame counts confirmed | 3 |
| **1** | Zones A–C: forest, castle, 5 puzzles, Calamitas | Her full cycle + 3 interludes + brothers. Puzzles provably solvable | 4 |
| **2** | Altar, fire door, city, merchant, New Home, sans | `tv_breakable` set; the TV can be broken | 2 |
| **3** | Tenna, 20 questions, 9 ranks, 9 rank rooms | Every rank reachable; lower rooms cumulative | 2 |
| **4** | Vending machine, hallucination, mushrooms, rap battle, crafting | Chart stays in sync 3 min; recipe discoverable | 3 |
| **5** | Wake-up, armchair, the crack, portal, Polterghast 3D | 3 phases + clone; 2D fallback works | 3 |
| **6** | Balance, a11y, full playthrough, deploy | 45 objectives tick in one scripted run | 2 |
| | | | **19** |

---

## 7. Testing

- **`fixes7`–`fixes14`**, one suite per zone, driving real state machines.
- **Every loop run twice.** Three dead ends in this project were caught only
  that way, and one of them shipped before the habit existed.
- **Save round-trip after every zone**: serialise → wipe → restore → assert
  identical. Highest-risk system, cheapest test.
- **Puzzle solvability by BFS** over the state space, not by playing them.
- **Full-playthrough script** Act I → IV asserting all 45 objectives.
- **Deploy check**: assert no file in `NEU.sheetSources` is present.

---

## 9. Phase 0 — what actually landed

Built and tested. **153 checks pass** (fixes5 50, fixes6 48, fixes7 55).

| Item | State |
|---|---|
| `js/save.js` — versioned, migration hook, quarantine, coalesced writes | done |
| `js/quest.js` — `snapshot()` / `restore()`, write-through on every tick | done |
| `js/engine.js` — tiles, swept collision, camera dead zone, entities, triggers, transitions, shared walk cycle, palette fallback | done |
| `js/data/sheets.js` — 38 sheets, measured frame grids | done |
| Sprite inspector (`sheet <name>`) + `save` / `wipe` dev commands | done |
| Endless mode in the room and the dark, personal bests on the tiles | done |
| Asset prune — 31 duplicates removed, source atlases quarantined | done |
| **Port `dark.js` and `bullet.js` onto the engine** | **done** — see the note below |
| `loader.js` | **dropped, deliberately** |

### Two deviations, both deliberate

**`loader.js` was dropped.** The plan had Act IV lazy-loading behind a
loader to keep boot at +0 KB. But the weight was never in the JS — it is in
the art, and images are already lazy by construction (`new Image()` only
fires when a sheet is first drawn). A loader would have deferred ~30 KB of
script and added a module, a loading state and a race. So boot carries
`save.js` + `engine.js` + `sheets.js`, and the 302 KB of art still loads on
first entry. **N3 is missed by ~30 KB and N4 is met with room to spare** —
worth saying plainly rather than quietly relaxing the budget.

**~~The ports did not happen.~~ THEY HAPPENED — this section was stale.**
Corrected 2026-08-17; it had been contradicting `PLAN.md` Phase 1, which
recorded the work as complete, for long enough that an inventory pass flagged
the two documents as disagreeing.

What actually shipped: `core/danmaku.js` was extracted and `bullet.js`,
`boss-scal.js` and `boss-polt.js` all run on it — no local `HEART` array, no
local i-frame constant, no local death-shatter loop in any of the three.
`dark.js` lost its own character sprite arrays and calls
`NEU.engine.drawPlayer` instead.

One thing deliberately did NOT get ported, and the wording above made it
sound like a failure rather than a decision: **walk mode keeps its own
`sweep`/`blocked`/`solidAt`**. Walk mode is not an engine room — it draws
onto the real page and collides against live DOM elements — so putting it
through the room collision would mean teaching the engine about the document.
That is the opposite of the "two engines is how this codebase dies" concern,
not an instance of it.

### Measured

```
runtime art   38 files   148 KB   ships
audio          6 files   154 KB   ships
source atlas  14 files  2574 KB   NEVER ships
                        ─────────
act IV total            302 KB    (budget 500 KB)
```

**~~Two of the five provisional frame counts are still provisional.~~ All
five settled** (`pending` 1.2): `sepulcher` is one unbroken band — one head,
not two frames (`frames: 1`); `heart` was cropped short of its own grid and
was re-padded to six bands on a 62px pitch; the Catastrophe slashes WERE
swapped and the fix moved geometry with the src. Verified by eye at 4–8x,
twice each.

- ~~`fireblast` 5 frames, `gigablast` 6, `hook` 2 — **confirmed**~~
- ~~`sepulcher` — one unbroken band, no gutter → `frames: 1, fps: 0`~~
- ~~`heart` — sheet re-padded 370→372px, `frames: 6, fh: 62`~~

---

## 8. What I need from you

~~1–3~~ **all resolved:** phase-by-phase happened (Phases 1–7 done —
`PLAN.md`); the frame counts and slash orientation are settled (`pending`
1.2/1.3); the quiz shipped with its answers. What still needs a human:
**item 3.5 in `pending.md`** — play it through on a real phone, headphones
on. 4. **Deploy permission stays per-push**, as always.

Nothing is built. Say go and Phase 0 starts.
